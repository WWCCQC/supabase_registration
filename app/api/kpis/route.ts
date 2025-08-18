export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function sanitize(s?: string | null) {
  if (!s) return "";
  return s.replace(/[,%]/g, " ").trim();
}

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
  else if (mode === "month") { const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth()+1, 0); start = sod(s); end = eod(e); }
  else if (mode === "custom" && from && to) { start = sod(new Date(from)); end = eod(new Date(to)); }
  if (start && end) return { gte: start.toISOString(), lte: end.toISOString() };
  return null;
}

function applyFilters(query: any, params: URLSearchParams) {
  const get = (k: string) => sanitize(params.get(k));
  const filters: Record<string, string> = {
    provider: get("provider"), area: get("area"), rsm: get("rsm"), ctm: get("ctm"),
    depot_code: get("depot_code"), work_type: get("work_type"), workgroup_status: get("workgroup_status"),
    gender: get("gender"), degree: get("degree"),
  };
  for (const [k, v] of Object.entries(filters)) if (v) query = query.ilike(k, `%${v}%`);
  const fNat = get("f_national_id"), fTech = get("f_tech_id"), fRsm = get("f_rsm"), fDepot = get("f_depot_code");
  if (fNat)   query = query.ilike("national_id", `%${fNat}%`);
  if (fTech)  query = query.ilike("tech_id", `%${fTech}%`);
  if (fRsm)   query = query.ilike("rsm", `%${fRsm}%`);
  if (fDepot) query = query.ilike("depot_code", `%${fDepot}%`);
  const q = get("q");
  if (q) {
    const cols = ["national_id","tech_id","full_name","gender","degree","phone","email","workgroup_status","work_type","provider","area","rsm","ctm","depot_code","depot_name","province"];
    const pat = `%${q}%`;
    query = query.or(cols.map(c => `${c}.ilike.${pat}`).join(","));
  }
  return query;
}

async function applyDateFilterSafe(baseQuery: any, params: URLSearchParams) {
  const range = parseDateRange(params);
  if (!range) return baseQuery;
  const candidates = ["__imported_at", "created_at"];
  for (const col of candidates) {
    try {
      const t = baseQuery.gte(col, range.gte).lte(col, range.lte).limit(0);
      const { error } = await t;
      if (!error) return baseQuery.gte(col, range.gte).lte(col, range.lte);
    } catch {}
  }
  return baseQuery;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const supabase = supabaseAdmin();

    // TOTAL
    let qTotal = supabase.from("technicians").select("*", { count: "exact", head: true });
    qTotal = applyFilters(qTotal, params);
    qTotal = await applyDateFilterSafe(qTotal, params);
    const { count: total = 0, error: eTotal } = await qTotal; if (eTotal) throw eTotal;

    // BY WORK_TYPE
    const by_work_type: { key: string; count: number; percent: number }[] = [];
    let qWT = supabase.from("technicians").select("work_type").not("work_type", "is", null).limit(5000);
    qWT = applyFilters(qWT, params); qWT = await applyDateFilterSafe(qWT, params);
    const { data: listWT = [], error: eWT } = await qWT; if (eWT) throw eWT;
    for (const raw of Array.from(new Set((listWT || []).map((r: any) => r.work_type).filter(Boolean)))) {
      const key = String(raw).trim();
      let q = supabase.from("technicians").select("*", { count: "exact", head: true }).ilike("work_type", `%${key}%`);
      q = applyFilters(q, params); q = await applyDateFilterSafe(q, params);
      const { count = 0 } = await q; by_work_type.push({ key, count, percent: total ? +(100 * count / total).toFixed(2) : 0 });
    }

    // BY PROVIDER
    const by_provider: { key: string; count: number; percent: number }[] = [];
    let qPv = supabase.from("technicians").select("provider").not("provider", "is", null).limit(5000);
    qPv = applyFilters(qPv, params); qPv = await applyDateFilterSafe(qPv, params);
    const { data: listPv = [], error: ePv } = await qPv; if (ePv) throw ePv;
    for (const raw of Array.from(new Set((listPv || []).map((r: any) => r.provider).filter(Boolean)))) {
      const key = String(raw).trim();
      let q = supabase.from("technicians").select("*", { count: "exact", head: true }).ilike("provider", `%${key}%`);
      q = applyFilters(q, params); q = await applyDateFilterSafe(q, params);
      const { count = 0 } = await q; by_provider.push({ key, count, percent: total ? +(100 * count / total).toFixed(2) : 0 });
    }

    return NextResponse.json({
      total,
      by_work_type: by_work_type.sort((a,b)=>b.count-a.count),
      by_provider: by_provider.sort((a,b)=>b.count-a.count),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}