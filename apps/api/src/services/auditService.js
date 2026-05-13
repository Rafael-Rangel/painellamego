import { supabaseAdmin } from "../lib/supabase.js";

export async function logAudit({ userId, action, resource, payload }) {
  await supabaseAdmin.from("audit_logs").insert({
    user_id: userId,
    action,
    resource,
    payload: payload ?? {}
  });
}
