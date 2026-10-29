import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  parseCompareDepotParams, parseCompareJobParams, parseCompareSummaryParams, parseCompareView,
  type CompareDashboard,
} from '@/lib/allconnectCompare';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FULL_RPC = 'allconnect_compare_jobs_dashboard';
const VIEW_RPC = {
  summary: 'allconnect_compare_summary',
  rows: 'allconnect_compare_rows',
  depot: 'allconnect_compare_depot_technicians',
} as const;

// PostgREST: the function does not exist yet (split SQL not applied) -> use the all-in-one function.
const isMissingFunction = (error: { code?: string } | null) => error?.code === 'PGRST202';

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401, headers });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.role !== 'admin' && payload.role !== 'manager' && payload.role !== 'allconnect_viewer') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงรายงานนี้' }, { status: 403, headers });
    }
  } catch {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, { status: 401, headers });
  }

  const search = request.nextUrl.searchParams;
  if (search.get('view') === 'hierarchy') {
    let params;
    try { params = parseCompareSummaryParams(search); } catch {
      return NextResponse.json({ error: 'ตัวกรองไม่ถูกต้อง' }, { status: 400, headers });
    }
    try {
      if (!params.p_rbm) return NextResponse.json({ error: 'กรุณาระบุ RBM' }, { status: 400, headers });
      const { data, error } = await supabaseAdmin().rpc('allconnect_compare_region_hierarchy', params).abortSignal(request.signal);
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [] }, { headers });
    } catch {
      return NextResponse.json({ error: 'โหลดลำดับชั้นพื้นที่ไม่สำเร็จ' }, { status: 500, headers });
    }
  }
  let view, params;
  try {
    view = parseCompareView(search);
    params = view === 'summary' ? parseCompareSummaryParams(search)
      : view === 'depot' ? parseCompareDepotParams(search)
      : parseCompareJobParams(search);
  } catch {
    return NextResponse.json({ error: 'ตัวกรองหรือหมายเลขหน้าไม่ถูกต้อง' }, { status: 400, headers });
  }

  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin().rpc(name, args).abortSignal(request.signal);
    return { data, error };
  };

  try {
    if (view === 'full') {
      const { data, error } = await call(FULL_RPC, params);
      if (error) throw error;
      if (!data) throw new Error('Comparison returned no data');
      return NextResponse.json(data, { headers });
    }

    const result = await call(VIEW_RPC[view], params);
    if (!isMissingFunction(result.error)) {
      if (result.error) throw result.error;
      if (result.data === null || result.data === undefined) throw new Error('Comparison returned no data');
      return NextResponse.json(view === 'depot' ? { technicians: result.data } : result.data, { headers });
    }

    // Fallback while create-allconnect-compare-split.sql has not been applied.
    const fallbackParams = view === 'depot'
      ? { p_rbm: null, p_status: 'all', p_search: '', p_page: 1, p_page_size: 1, p_month: params.p_month }
      : view === 'summary' ? { ...parseCompareJobParams(search), p_page_size: 1 } : params;
    const { data, error } = await call(FULL_RPC, fallbackParams);
    if (error) throw error;
    if (!data) throw new Error('Comparison returned no data');
    const full = data as CompareDashboard;
    if (view === 'depot') {
      const depot = params as ReturnType<typeof parseCompareDepotParams>;
      const match = full.depots.find(item => item.rbm === depot.p_rbm &&
        item.depotCode === depot.p_depot_code && item.depotName === depot.p_depot_name);
      return NextResponse.json({ technicians: match?.withoutWorkTechnicians ?? [] }, { headers });
    }
    return NextResponse.json(full, { headers });
  } catch (error) {
    console.error('Allconnect comparison failed:', error);
    return NextResponse.json({ error: 'โหลดข้อมูลเปรียบเทียบไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500, headers });
  }
}
