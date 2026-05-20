import { supabaseAdmin } from "../lib/supabase.js";

export async function recalculateProductSnapshot(productId) {
  const { data, error } = await supabaseAdmin
    .from("purchase_items")
    .select("unit_price")
    .eq("product_id", productId);
  if (error) {
    console.error("[price-snapshot] leitura falhou", { productId, message: error.message });
    return { ok: false, error: error.message };
  }
  if (!data?.length) return { ok: true, skipped: true };

  const prices = data.map((row) => Number(row.unit_price)).filter((n) => Number.isFinite(n) && n > 0);
  if (!prices.length) return { ok: true, skipped: true };

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
  if (upsertError) {
    console.error("[price-snapshot] upsert falhou", { productId, message: upsertError.message });
    return { ok: false, error: upsertError.message };
  }

  return { ok: true, minPrice, maxPrice, avgPrice };
}
