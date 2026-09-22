import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const token = request.cookies.get('auth-token')?.value;
  const secret = process.env.JWT_SECRET;
  if (!secret) return NextResponse.json({ error: 'ระบบยืนยันตัวตนไม่พร้อมใช้งาน' }, { status: 500, headers });
  try {
    if (!token) throw new Error('Missing token');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    if (!payload.userId || !['admin', 'manager', 'user'].includes(String(payload.role))) throw new Error('Invalid user');
  } catch {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, { status: 401, headers });
  }
  try {
    const client = supabaseAdmin();
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from('contract_c').select('*')
        .order('company_registration_no').range(offset, offset + 999).abortSignal(request.signal);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ rows }, { headers });
  } catch {
    return NextResponse.json({ error: 'โหลดข้อมูลสัญญาไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500, headers });
  }
}
