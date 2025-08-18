export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const sanitize = (s?: string | null) => (s ?? "").replace(/[,%]/g, " ").trim();

function parseDateRange(params: URLSearchParams) {
  const mode = params.get("date_mode") || "";
  const from = params.get("date_from");
  const to = params.get("date_to");
  const now = new Date();

  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  let start: Date | null = null, end: Date | null = null;
  if (mode === "today") { start = sod(now); end = eod(now); }
  else if (mode === "7d") { const s = new Date(now); s.setDate(s.getDate() - 6); start = sod(s); end = eod(now); }
  else if (mode === "month") { const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); start = sod(s); end = eod(e); }
  else if (mode === "custom" && from && to) { start = sod(new Date(from)); end = eod(new Date(to)); }

  if (start && end) return { gte: start.toISOString(), lte: end.toISOString() };
  return null;
}

/** ใช้ได้ทั้ง .ilike() และ .filter('ilike') — และ cast เป็น any กัน TS */
function ilike(q: any, col: string, pattern: string) {
  if (typeof q.ilike === "function") return q.ilike(col, pattern);
  return q.filter(col, "ilike", pattern);
}
const rangeFilter = (q: any, col: string, g: string, l: string) => q.gte(col, g).lte(col, l);

function applyFilters(queryIn: any, params: URLSearchParams) {
  const get = (k: string) => sanitize(params.get(k));
  let query = queryIn as any;

  const filters: Record<string, string> = {
    provider: get("provider"),
    area: get("area"),
    rsm: get("rsm"),
    ctm: get("ctm"),
    depot_code: get("depot_code"),
    work_type: get("work_type"),
    workgroup_status: get("workgroup_status"),
    gender: get("gender"),
    degree: get("degree"),
  };
  for (const [k, v] of Object.entries(filters)) if (v) query = ilike(query, k, `%${v}%`);

  // quick exact filters
  const fNat = get("f_national_id");
  const fTech = get("f_tech_id");
  const fRsm = get("f_rsm");
  const fDepot = get("f_depot_code");

  if (fNat)   query = ilike(query, "national_id", `%${fNat}%`);
  if (fTech)  query = ilike(query, "tech_id", `%${fTech}%`);
  if (fRsm)   query = ilike(query, "rsm", `%${fRsm}%`);
  if (fDepot) query = ilike(query, "depot_code", `%${fDepot}%`);

  // free text
  const q = get("q");
  if (q) {
    const pat = `%${q}%`;
    const cols = [
      "national_id","tech_id","full_name","gender","degree","phone","email",
      "workgroup_status","work_type","provider","area","rsm","ctm",
      "depot_code","depot_name","province"
    ];
    query = query.or(cols.map(c => `${c}.ilike.${pat}`).join(","));
  }
  return query;
}

async function applyDateFilterSafe(baseQueryIn: any, params: URLSearchParams) {
  const baseQuery = baseQueryIn as any;
  const range = parseDateRange(params);
  if (!range) return baseQuery;

  for (const col of ["__imported_at", "created_at"]) {
    try {
      const test = rangeFilter(baseQuery, col, range.gte, range.lte).limit(0);
      const { error } = await test;
      if (!error) return rangeFilter(baseQuery, col, range.gte, range.lte);
    } catch {}
  }
  return baseQuery;
}

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const supabase = supabaseAdmin();

    // 1) TOTAL
    let qTotal: any = supabase.from("technicians").select("*", { count: "exact", head: true });
    qTotal = applyFilters(qTotal, params);
    qTotal = await applyDateFilterSafe(qTotal, params);
    const { count: total = 0, error: eTotal } = await qTotal;
    if (eTotal) throw eTotal;

    // 2) BY WORK_TYPE
    let qWT: any = supabase.from("technicians")
      .select("work_type")
      .not("work_type", "is", null)
      .limit(5000);
    qWT = applyFilters(qWT, params);
    qWT = await applyDateFilterSafe(qWT, params);
    const { data: listWT = [], error: eWT } = await qWT;
    if (eWT) throw eWT;

    const workTypeKeys = Array.from(new Set((listWT as any[]).map(r => r.work_type).filter(Boolean)));
    const by_work_type: { key: string; count: number; percent: number }[] = [];
    for (const keyRaw of workTypeKeys) {
      const key = String(keyRaw).trim();
      let q: any = supabase.from("technicians").select("*", { count: "exact", head: true });
      q = ilike(q, "work_type", `%${key}%`);
      q = applyFilters(q, params);
      q = await applyDateFilterSafe(q, params);
      const { count = 0 } = await q;
      by_work_type.push({ key, count, percent: total ? +(100 * count / total).toFixed(2) : 0 });
    }

    // 3) BY PROVIDER
    let qPv: any = supabase.from("technicians")
      .select("provider")
      .not("provider", "is", null)
      .limit(5000);
    qPv = applyFilters(qPv, params);
    qPv = await applyDateFilterSafe(qPv, params);
    const { data: listPv = [], error: ePv } = await qPv;
    if (ePv) throw ePv;

    const providerKeys = Array.from(new Set((listPv as any[]).map(r => r.provider).filter(Boolean)));
    const by_provider: { key: string; count: number; percent: number }[] = [];
    for (const keyRaw of providerKeys) {
      const key = String(keyRaw).trim();
      let q: any = supabase.from("technicians").select("*", { count: "exact", head: true });
      q = ilike(q, "provider", `%${key}%`);
      q = applyFilters(q, params);
      q = await applyDateFilterSafe(q, params);
      const { count = 0 } = await q;
      by_provider.push({ key, count, percent: total ? +(100 * count / total).toFixed(2) : 0 });
    }

    return NextResponse.json({
      total,
      by_work_type: by_work_type.sort((a, b) => b.count - a.count),
      by_provider: by_provider.sort((a, b) => b.count - a.count),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
