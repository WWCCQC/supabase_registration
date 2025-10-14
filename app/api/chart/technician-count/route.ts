export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    console.log('🔧 Technician Count API called');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌');
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? '✅' : '❌');
    
    const url = new URL(req.url);
    
    // Get filter parameters
    const f_national_id = url.searchParams.get("f_national_id") || "";
    const f_tech_id = url.searchParams.get("f_tech_id") || "";
    const f_rsm = url.searchParams.get("f_rsm") || "";
    const f_ctm = url.searchParams.get("f_ctm") || "";
    const f_depot_code = url.searchParams.get("f_depot_code") || "";
    const f_training_type = url.searchParams.get("f_training_type") || "";
    const q = url.searchParams.get("q") || "";
    const selectedRsm = url.searchParams.get("rsm") || "";
    const selectedCtm = url.searchParams.get("ctm") || "";

    const supabase = supabaseAdmin();

    // Build base query for all technicians (both หัวหน้า and ลูกน้อง) from Supabase
    let query = supabase
      .from("technicians")
      .select("rsm, provider, work_type, workgroup_status, national_id")
      .in("workgroup_status", ["หัวหน้า", "ลูกน้อง"]);

    console.log('📊 Querying Supabase for all technicians...');

    // Apply filters to Supabase query
    if (f_national_id) query = query.ilike("national_id", `%${f_national_id}%`);
    if (f_tech_id) query = query.ilike("tech_id", `%${f_tech_id}%`);
    if (f_rsm) query = query.ilike("rsm", `%${f_rsm}%`);
    if (f_ctm) query = query.ilike("ctm", `%${f_ctm}%`);
    if (f_depot_code) query = query.ilike("depot_code", `%${f_depot_code}%`);
    if (selectedRsm) query = query.ilike("rsm", `%${selectedRsm}%`);
    if (selectedCtm) query = query.ilike("ctm", `%${selectedCtm}%`);
    
    // Apply training type filter
    if (f_training_type) {
      const serviceColumns = [
        "svc_install","svc_repair","svc_nonstandard","svc_corporate","svc_solar",
        "svc_fttr","svc_2g","svc_cctv","svc_cyod","svc_dongle","svc_iot",
        "svc_gigatex","svc_wifi","svc_smarthome","svc_catv_settop_box",
        "svc_true_id","svc_true_inno","svc_l3"
      ];
      
      if (serviceColumns.includes(f_training_type)) {
        query = query.eq(f_training_type, "Pass");
      }
    }

    // Apply general search
    if (q) {
      const cols = [
        "national_id", "tech_id", "full_name", "gender", "age", "degree",
        "phone", "email", "workgroup_status", "work_type", "provider", 
        "area", "rsm", "ctm", "depot_code", "depot_name", "province"
      ];
      const pattern = `%${q}%`;
      const ors = cols.map(c => `${c}.ilike.${pattern}`).join(",");
      query = query.or(ors);
    }

    // Fetch all data with pagination
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('❌ Technician count error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      console.log(`📊 Technician batch ${page + 1}: ${pageData.length} records, total: ${allData.length}`);
      
      if (pageData.length < pageSize) break;
      page++;
    }

    console.log('📊 Total technicians count:', allData.length);

    // Process data into pivot format - Count unique national_id
    const result: Record<string, Record<string, Set<string>>> = {};

    allData.forEach((row: any) => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      const nationalId = row.national_id;

      if (!nationalId) return; // Skip rows without national_id

      if (!result[rsm]) {
        result[rsm] = {};
      }

      // Count unique national_id by provider_worktype combination
      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        if (!result[rsm][key]) result[rsm][key] = new Set();
        result[rsm][key].add(nationalId);
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        if (!result[rsm][key]) result[rsm][key] = new Set();
        result[rsm][key].add(nationalId);
      }

      // Count unique national_id by provider totals
      if (!result[rsm][provider]) result[rsm][provider] = new Set();
      result[rsm][provider].add(nationalId);
    });

    // Convert Sets to counts
    const finalResult: Record<string, Record<string, number>> = {};
    Object.keys(result).forEach(rsm => {
      finalResult[rsm] = {};
      Object.keys(result[rsm]).forEach(key => {
        finalResult[rsm][key] = result[rsm][key].size;
      });
    });

    console.log('📊 Technician count result:', finalResult);

    return NextResponse.json(finalResult);

  } catch (e: any) {
    console.error('❌ Technician count API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}