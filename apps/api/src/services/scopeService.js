import { supabaseAdmin } from "../lib/supabase.js";

export async function getManagerStoreIds(user) {
  if (!user?.id) return [];
  const { data, error } = await supabaseAdmin
    .from("manager_store_links")
    .select("store_id")
    .eq("manager_auth_user_id", user.id);

  if (error) return user.storeId ? [user.storeId] : [];
  const ids = (data || []).map((row) => row.store_id).filter(Boolean);
  if (!ids.length && user.storeId) return [user.storeId];
  return ids;
}
