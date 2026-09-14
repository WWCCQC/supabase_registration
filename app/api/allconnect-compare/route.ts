import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseCompareParams } from '@/lib/allconnectCompare';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.role !== 'admin' && payload.role !== 'manager') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงรายงานนี้' }, { status: 403, headers });
    }
  } catch {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, { status: 401, headers });
  }

  let params;
  try {
    params = parseCompareParams(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: 'ตัวกรองหรือหมายเลขหน้าไม่ถูกต้อง' }, { status: 400, headers });
  }

  try {
    const { data, error } = await supabaseAdmin()
      .rpc('allconnect_compare_dashboard', params)
      .abortSignal(request.signal);
    if (error) throw error;
    if (!data) throw new Error('Comparison returned no data');
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('Allconnect comparison failed:', error);
    return NextResponse.json({ error: 'โหลดข้อมูลเปรียบเทียบไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500, headers });
  }
}
