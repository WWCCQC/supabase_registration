import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const secret = process.env.JWT_SECRET;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!secret) {
    return NextResponse.json({ error: 'Server authentication is not configured' }, { status: 500 });
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = supabaseAdmin();
    const data = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data: page, error } = await supabase
        .from('admin_sale')
        .select('uuid,full_name,depot_code,store_code_100xxx,code_39xxx,dealer_name,phone_no,image,store_email')
        .order('uuid', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      data.push(...(page ?? []));
      if (!page || page.length < pageSize) break;
    }
    const { data: latest, error: latestError } = await supabase
      .from('admin_sale')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    return NextResponse.json({ data, updatedAt: latest?.updated_at ?? null }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to load admin_sale:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลแอดมินงานขายได้' }, { status: 500 });
  }
}
