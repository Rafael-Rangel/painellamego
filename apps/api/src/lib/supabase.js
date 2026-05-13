import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

const url = config.supabaseUrl || "http://localhost:54321";
const key = config.supabaseServiceRoleKey || "test-service-role-key";

export const supabaseAdmin = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
