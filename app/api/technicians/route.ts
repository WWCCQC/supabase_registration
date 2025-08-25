export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function sanitizeQ(s?: string | null) {
  if (!s) return "";
  return s.replace(/[,%]/g, " ").trim();
}

export async function GET(req: Request) {
  try {
    // Debug environment variables
    console.log('🔧 API Environment check:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌');
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? '✅' : '❌');
    
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50")));

    const f_national_id = url.searchParams.get("national_id") || "";
    const f_tech_id     = url.searchParams.get("tech_id") || "";
    const f_rsm         = url.searchParams.get("rsm") || "";
    const f_depot_code  = url.searchParams.get("depot_code") || "";
    const q             = sanitizeQ(url.searchParams.get("q"));

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const cols = [
      "national_id","tech_id","full_name","gender","age","degree",
      "doc_tech_card_url","phone","email","workgroup_status","work_type",
      "provider","area","rsm","ctm","depot_code","depot_name","province"
    ] as const;

    // sort params
    const sortParam = (url.searchParams.get("sort") || "national_id").toLowerCase();
    const dirParam  = (url.searchParams.get("dir")  || "asc").toLowerCase();
    const sort = cols.includes(sortParam as any) ? sortParam : "national_id";
    const ascending = dirParam !== "desc";

    const supabase = supabaseAdmin();
    
    // Query สำหรับนับจำนวนทั้งหมด (ไม่ใช้ range)
    let countQuery = supabase.from("technicians").select("*", { count: "exact", head: true });

    if (f_national_id) countQuery = countQuery.ilike("national_id", `%${f_national_id}%`);
    if (f_tech_id)     countQuery = countQuery.ilike("tech_id",     `%${f_tech_id}%`);
    if (f_rsm)         countQuery = countQuery.ilike("rsm",         `%${f_rsm}%`);
    if (f_depot_code)  countQuery = countQuery.ilike("depot_code",  `%${f_depot_code}%`);

    if (q) {
      const pattern = `%${q}%`;
      const ors = cols.map(c => `${c}.ilike.${pattern}`).join(",");
      countQuery = countQuery.or(ors);
    }

    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('❌ Count error:', countError);
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    // Query สำหรับดึงข้อมูลหน้าปัจจุบัน (ใช้ range)
    let dataQuery = supabase.from("technicians").select("*");
    
    if (f_national_id) dataQuery = dataQuery.ilike("national_id", `%${f_national_id}%`);
    if (f_tech_id)     dataQuery = dataQuery.ilike("tech_id",     `%${f_tech_id}%`);
    if (f_rsm)         dataQuery = dataQuery.ilike("rsm",         `%${f_rsm}%`);
    if (f_depot_code)  dataQuery = dataQuery.ilike("depot_code",  `%${f_depot_code}%`);

    if (q) {
      const pattern = `%${q}%`;
      const ors = cols.map(c => `${c}.ilike.${pattern}`).join(",");
      dataQuery = dataQuery.or(ors);
    }

    dataQuery = dataQuery.order(sort, { ascending, nullsFirst: true }).range(from, to);

    const { data, error } = await dataQuery;
    
    console.log('📊 Query result - count:', count, 'data length:', data?.length);
    
    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []).map((r: any) => ({
      national_id:        r.national_id        ?? null,
      tech_id:            r.tech_id            ?? null,
      full_name:          r.full_name          ?? (r.tech_first_name && r.tech_last_name
                               ? `${r.tech_first_name} ${r.tech_last_name}`
                               : (r.tech_first_name ?? r.tech_last_name ?? null)),
      gender:             r.gender             ?? null,
      age:                r.age                ?? null,
      degree:             r.degree             ?? null,
      doc_tech_card_url:  r.doc_tech_card_url  ?? r.tech_card_url ?? null,
      phone:              r.phone              ?? r.tel ?? null,
      email:              r.email              ?? null,
      workgroup_status:   r.workgroup_status   ?? r.status ?? null,
      work_type:          r.work_type          ?? r.team_type ?? null,
      provider:           r.provider           ?? null,
      area:               r.area               ?? null,
      rsm:                r.rsm                ?? null,
      ctm:                r.ctm                ?? null,
      depot_code:         r.depot_code         ?? null,
      depot_name:         r.depot_name         ?? null,
      province:           r.province           ?? r.ctm_province ?? null,
    }));

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return NextResponse.json({ rows, page, pageSize, total, totalPages }, {
      headers: {
        'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'pragma': 'no-cache',
        'expires': '0',
        'surrogate-control': 'no-store',
        'x-vercel-cache': 'no-cache'
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
