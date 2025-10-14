// app/api/db-health/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // กัน cache
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' }, 
      { status: 500 }
    );
  }

  const res = await fetch(`${url}/rest/v1/technicians?select=national_id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact,head=true',
    },
    cache: 'no-store',
  });

  return NextResponse.json({
    supabaseUrl: url,
    status: res.status,
    contentRange: res.headers.get('content-range'), // ควรลงท้ายด้วย /2975
  });
}

