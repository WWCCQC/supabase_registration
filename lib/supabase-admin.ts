import "server-only";
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!; // server-only
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "supabase-registration-admin" } },
  });
}
