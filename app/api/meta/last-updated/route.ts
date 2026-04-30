// app/api/meta/last-updated/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    // ลองดึง max(__imported_at) ก่อน ถ้าไม่มีคอลัมน์ให้ fallback ไป created_at
    const candidates = ['__imported_at', 'created_at'];
    let lastUpdated: string | null = null;

    for (const col of candidates) {
      const { data, error } = await supabase
        .from('technicians')
        .select(col)
        .order(col, { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        lastUpdated = (data as any)[col] ?? null;
        break;
      }
    }

    return NextResponse.json({ lastUpdated });
  } catch (err: any) {
    console.error('last-updated API error:', err);
    return NextResponse.json({ lastUpdated: null, error: err.message }, { status: 500 });
  }
}
