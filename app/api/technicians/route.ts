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
    const f_ctm         = url.searchParams.get("ctm") || "";
    const f_depot_code  = url.searchParams.get("depot_code") || "";
    const f_training_type = url.searchParams.get("training_type") || "";
    const q             = sanitizeQ(url.searchParams.get("q"));

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // Define service/training columns
    const serviceColumns = [
      "svc_install","svc_repair","svc_nonstandard","svc_corporate","svc_solar",
      "svc_fttr","svc_2g","svc_cctv","svc_cyod","svc_dongle","svc_iot",
      "svc_gigatex","svc_wifi","svc_smarthome","svc_catv_settop_box",
      "svc_true_id","svc_true_inno","svc_l3"
    ];

    const cols = [
      "national_id","tech_id","full_name","gender","age","degree",
      "doc_tech_card_url","phone","email","workgroup_status","work_type",
      "provider","area","rsm","ctm","depot_code","depot_name","province",
      ...serviceColumns
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
    if (f_ctm)         countQuery = countQuery.ilike("ctm",         `%${f_ctm}%`);
    if (f_depot_code)  countQuery = countQuery.ilike("depot_code",  `%${f_depot_code}%`);
    
    // กรองตามประเภทการอบรม - ค้นหาคอลัมน์ที่มีค่า "Pass"
    if (f_training_type) {
      // ตรวจสอบว่าค่าที่เลือกอยู่ในรายการที่รองรับ
      if (serviceColumns.includes(f_training_type)) {
        countQuery = countQuery.eq(f_training_type, "Pass");
      }
    }

    if (q) {
      // Check if query matches a service column name (e.g., "iot" -> "svc_iot")
      const qLower = q.toLowerCase();
      const matchedServiceCol = serviceColumns.find(col => 
        col.toLowerCase().includes(qLower) || col.replace('svc_', '').toLowerCase() === qLower
      );

      if (matchedServiceCol) {
        // If query matches a service column, search for "Pass" in that column
        console.log(`🎯 Query "${q}" matches service column "${matchedServiceCol}" - searching for Pass`);
        countQuery = countQuery.eq(matchedServiceCol, "Pass");
      } else {
        // Regular text search across all columns
        const pattern = `%${q}%`;
        const ors = cols.map(c => `${c}.ilike.${pattern}`).join(",");
        countQuery = countQuery.or(ors);
      }
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
    if (f_ctm)         dataQuery = dataQuery.ilike("ctm",         `%${f_ctm}%`);
    if (f_depot_code)  dataQuery = dataQuery.ilike("depot_code",  `%${f_depot_code}%`);
    
    // กรองตามประเภทการอบรม - ค้นหาคอลัมน์ที่มีค่า "Pass"
    if (f_training_type) {
      // ตรวจสอบว่าค่าที่เลือกอยู่ในรายการที่รองรับ
      if (serviceColumns.includes(f_training_type)) {
        dataQuery = dataQuery.eq(f_training_type, "Pass");
      }
    }

    if (q) {
      // Check if query matches a service column name (e.g., "iot" -> "svc_iot")
      const qLower = q.toLowerCase();
      const matchedServiceCol = serviceColumns.find(col => 
        col.toLowerCase().includes(qLower) || col.replace('svc_', '').toLowerCase() === qLower
      );

      if (matchedServiceCol) {
        // If query matches a service column, search for "Pass" in that column
        console.log(`🎯 Query "${q}" matches service column "${matchedServiceCol}" - searching for Pass`);
        dataQuery = dataQuery.eq(matchedServiceCol, "Pass");
      } else {
        // Regular text search across all columns
        const pattern = `%${q}%`;
        const ors = cols.map(c => `${c}.ilike.${pattern}`).join(",");
        dataQuery = dataQuery.or(ors);
        console.log('🔍 Search query (q):', q, '- Searching in', cols.length, 'columns');
      }
    }

    dataQuery = dataQuery.order(sort, { ascending, nullsFirst: true }).range(from, to);

    const { data, error } = await dataQuery;
    
    console.log('📊 Query result - Total matching records:', count, '| Displaying:', data?.length, 'records (page', page, ')');
    
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
      // Service columns
      svc_install:        r.svc_install        ?? null,
      svc_repair:         r.svc_repair         ?? null,
      svc_nonstandard:    r.svc_nonstandard    ?? null,
      svc_corporate:      r.svc_corporate      ?? null,
      svc_solar:          r.svc_solar          ?? null,
      svc_fttr:           r.svc_fttr           ?? null,
      svc_2g:             r.svc_2g             ?? null,
      svc_cctv:           r.svc_cctv           ?? null,
      svc_cyod:           r.svc_cyod           ?? null,
      svc_dongle:         r.svc_dongle         ?? null,
      svc_iot:            r.svc_iot            ?? null,
      svc_gigatex:        r.svc_gigatex        ?? null,
      svc_wifi:           r.svc_wifi           ?? null,
      svc_smarthome:      r.svc_smarthome      ?? null,
      svc_catv_settop_box: r.svc_catv_settop_box ?? null,
      svc_true_id:        r.svc_true_id        ?? null,
      svc_true_inno:      r.svc_true_inno      ?? null,
      svc_l3:             r.svc_l3             ?? null,
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
