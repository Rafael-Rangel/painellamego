import { supabaseAdmin } from "../lib/supabase.js";

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
