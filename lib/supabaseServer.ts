import { createClient } from '@supabase/supabase-js';

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  
  return createClient(
    url,
    key,
    {
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    }
  );
}
