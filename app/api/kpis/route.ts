// app/api/kpis/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function sanitize(s?: string | null) {
  if (!s) return '';
  return s.replace(/[,%]/g, ' ').trim();
}

function parseDateRange(params: URLSearchParams) {
  const mode = params.get('date_mode') || '';
  const from = params.get('date_from');
  const to = params.get('date_to');
  const now = new Date();

  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  let start: Date | null = null,
    end: Date | null = null;

  if (mode === 'today') {
    start = sod(now);
    end = eod(now);
  } else if (mode === '7d') {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    start = sod(s);
    end = eod(now);
  } else if (mode === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start = sod(s);
    end = eod(e);
  } else if (mode === 'custom' && from && to) {
    start = sod(new Date(from));
    end = eod(new Date(to));
  }

  if (start && end) return { gte: start.toISOString(), lte: end.toISOString() };
  return null;
}

function applyFilters(query: any, params: URLSearchParams) {
  const get = (k: string) => sanitize(params.get(k));

  const filters: Record<string, string> = {
    provider: get('provider'),
    area: get('area'),
    rsm: get('rsm'),
    ctm: get('ctm'),
    depot_code: get('depot_code'),
    work_type: get('work_type'),
    workgroup_status: get('workgroup_status'),
    gender: get('gender'),
    degree: get('degree'),
  };

  for (const [k, v] of Object.entries(filters)) {
    if (v) query = (query as any).ilike(k, `%${v}%`);
  }

  const fNat = get('f_national_id');
  const fTech = get('f_tech_id');
  const fRsm = get('f_rsm');
  const fCtm = get('f_ctm');
  const fDepot = get('f_depot_code');

  if (fNat) query = (query as any).ilike('national_id', `%${fNat}%`);
  if (fTech) query = (query as any).ilike('tech_id', `%${fTech}%`);
  if (fRsm) query = (query as any).ilike('rsm', `%${fRsm}%`);
  if (fCtm) query = (query as any).ilike('ctm', `%${fCtm}%`);
  if (fDepot) query = (query as any).ilike('depot_code', `%${fDepot}%`);

  const q = sanitize(params.get('q'));
  if (q) {
    const cols = [
      'national_id',
      'tech_id',
      'full_name',
      'gender',
      'degree',
      'phone',
      'email',
      'workgroup_status',
      'work_type',
      'provider',
      'area',
      'rsm',
      'ctm',
      'depot_code',
      'depot_name',
      'province',
    ];
    const pat = `%${q}%`;
    query = (query as any).or(cols.map((c) => `${c}.ilike.${pat}`).join(','));
  }

  return query;
}

async function applyDateFilterSafe(baseQuery: any, params: URLSearchParams) {
  const range = parseDateRange(params);
  if (!range) return baseQuery;

  // พยายามใช้ __imported_at ก่อน ถ้าไม่มีให้ลอง created_at
  const candidates = ['__imported_at', 'created_at'];
  for (const col of candidates) {
    try {
      const probe = (baseQuery as any).gte(col, range.gte).lte(col, range.lte).limit(0);
      const { error } = await probe;
      if (!error) {
        return (baseQuery as any).gte(col, range.gte).lte(col, range.lte);
      }
    } catch {
      // ไม่มีคอลัมน์นี้ → ลองตัวถัดไป
    }
  }
  return baseQuery;
}

/** ดึงค่าที่ต่างกันของคอลัมน์ (distinct) แบบ paginate เพื่อไม่ติดลิมิต 1000 */
async function collectDistinct(
  supabase: ReturnType<typeof supabaseAdmin>,
  column: 'work_type' | 'provider',
  params: URLSearchParams
) {
  const set = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    let q: any = supabase.from('technicians').select(column).not(column, 'is', null).range(from, from + pageSize - 1);
    q = applyFilters(q, params);
    q = await applyDateFilterSafe(q, params);
    const { data, error } = await q;
    if (error) throw error;

    for (const r of data ?? []) {
      const v = (r as any)[column];
      if (v != null && v !== '') set.add(String(v).trim());
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from(set);
}

export async function GET(req: Request) {
  try {
    // Debug environment variables
    console.log('🔧 KPI API Environment check:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌');
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? '✅' : '❌');
    
    const url = new URL(req.url);
    const params = url.searchParams;
    const supabase = supabaseAdmin();

    // ===== TOTAL (ใช้ count ที่ไม่ติดลิมิต)
    let qTotal: any = supabase.from('technicians').select('*', { count: 'exact', head: true });
    qTotal = applyFilters(qTotal, params);
    qTotal = await applyDateFilterSafe(qTotal, params);
    const { count: total = 0, error: eTotal } = await qTotal;
    if (eTotal) throw eTotal;

    // ===== BY WORK_TYPE (distinct + count per key)
    const by_work_type: { key: string; count: number; percent: number }[] = [];
    const workTypes = await collectDistinct(supabase, 'work_type', params);

    for (const key of workTypes) {
      let q: any = supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('work_type', key);
      q = applyFilters(q, params);
      q = await applyDateFilterSafe(q, params);
      const { count = 0, error } = await q;
      if (error) throw error;
      by_work_type.push({
        key,
        count,
        percent: total ? +((100 * count) / total).toFixed(2) : 0,
      });
    }

    // ===== BY PROVIDER (distinct + count per key)
    const by_provider: { key: string; count: number; percent: number }[] = [];
    const providers = await collectDistinct(supabase, 'provider', params);

    for (const key of providers) {
      let q: any = supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('provider', key);
      q = applyFilters(q, params);
      q = await applyDateFilterSafe(q, params);
      const { count = 0, error } = await q;
      if (error) throw error;
      by_provider.push({
        key,
        count,
        percent: total ? +((100 * count) / total).toFixed(2) : 0,
      });
    }

    const body = {
      total,
      by_work_type: by_work_type.sort((a, b) => b.count - a.count),
      by_provider: by_provider.sort((a, b) => b.count - a.count),
    };

    return new NextResponse(JSON.stringify(body), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'pragma': 'no-cache',
        'expires': '0',
        'surrogate-control': 'no-store',
        'x-vercel-cache': 'no-cache'
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
