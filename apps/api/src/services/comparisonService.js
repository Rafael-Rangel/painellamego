import { supabaseAdmin } from "../lib/supabase.js";

function formatBrl(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export async function recalculateProductSnapshot(productId) {
  const { data, error } = await supabaseAdmin
    .from("purchase_items")
    .select("unit_price, stores!inner(id,name)")
    .eq("product_id", productId);
  if (error) throw error;
  if (!data?.length) return null;

  const prices = data.map((row) => Number(row.unit_price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  const { error: upsertError } = await supabaseAdmin.from("price_snapshots").upsert(
    {
      product_id: productId,
      min_price: minPrice,
      max_price: maxPrice,
      avg_price: avgPrice,
      updated_at: new Date().toISOString()
    },
    { onConflict: "product_id" }
  );
  if (upsertError) throw upsertError;

  return { minPrice, maxPrice, avgPrice };
}

/**
 * Cria alertas legíveis (produto + lojas + valores) e remove alertas antigos
 * do mesmo produto na mesma loja para evitar linhas repetidas no painel.
 */
export async function createPriceAlertsForStore(storeId, productId, unitPrice) {
  const { data: snapshot, error: snapshotError } = await supabaseAdmin
    .from("price_snapshots")
    .select("*")
    .eq("product_id", productId)
    .single();
  if (snapshotError || !snapshot) return;

  const [{ data: productRow }, { data: storeRow }] = await Promise.all([
    supabaseAdmin.from("products").select("name").eq("id", productId).maybeSingle(),
    supabaseAdmin.from("stores").select("name").eq("id", storeId).maybeSingle()
  ]);

  const productName = productRow?.name || "Produto";
  const myStoreName = storeRow?.name || "Sua loja";

  await supabaseAdmin.from("alerts").delete().eq("store_id", storeId).eq("product_id", productId);

  const { data: bestRows } = await supabaseAdmin
    .from("v_product_store_prices")
    .select("store_id, store_name, unit_price")
    .eq("product_id", productId)
    .order("unit_price", { ascending: true });

  const up = Number(unitPrice);
  const avg = Number(snapshot.avg_price);
  const minNet = Number(snapshot.min_price);

  const alerts = [];

  if (up > avg * 1.08) {
    const pctAbove = avg > 0 ? (((up - avg) / avg) * 100).toFixed(1) : "0";
    alerts.push({
      store_id: storeId,
      product_id: productId,
      type: "above_average",
      message: `${productName} — na ${myStoreName} este lançamento ficou em ${formatBrl(up)} (média da rede: ${formatBrl(avg)}, ou seja, ${pctAbove}% acima da média).`
    });
  }

  if (bestRows?.length && up > minNet * 1.1) {
    const best = bestRows[0];
    const bestStoreName = best.store_name || "outra unidade da rede";
    const bestPrice = Number(best.unit_price);
    alerts.push({
      store_id: storeId,
      product_id: productId,
      type: "cheaper_supplier_exists",
      message: `${productName} — o menor preço registrado na rede está na ${bestStoreName} (${formatBrl(bestPrice)}). Neste lançamento você pagou ${formatBrl(up)}.`
    });
  }

  if (!alerts.length) return;
  await supabaseAdmin.from("alerts").insert(alerts);
}
