import "server-only";
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "supabase-registration-admin" } },
  });
}
