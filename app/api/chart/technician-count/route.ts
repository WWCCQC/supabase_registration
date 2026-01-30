export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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

    // Build base query for all technicians from Supabase
    // Note: ไม่กรอง workgroup_status เพราะต้องการนับทุกคน
    let query = supabase
      .from("technicians")
      .select("RBM, provider, work_type, workgroup_status, national_id");

    console.log('📊 Querying Supabase for all technicians...');

    // Apply filters to Supabase query
    if (f_national_id) query = query.ilike("national_id", `%${f_national_id}%`);
    if (f_tech_id) query = query.ilike("tech_id", `%${f_tech_id}%`);
    if (f_rsm) query = query.ilike("RBM", `%${f_rsm}%`);
    if (f_ctm) query = query.ilike("CBM", `%${f_ctm}%`);
    if (f_depot_code) query = query.ilike("depot_code", `%${f_depot_code}%`);
    if (selectedRsm) query = query.ilike("RBM", `%${selectedRsm}%`);
    if (selectedCtm) query = query.ilike("CBM", `%${selectedCtm}%`);
    
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
        "area", "RBM", "CBM", "depot_code", "depot_name", "province"
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

    // Process data into pivot format - Count all records (not unique national_id)
    const result: Record<string, Record<string, number>> = {};

    allData.forEach((row: any) => {
      const rsm = row.RBM || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";

      if (!rsm || !provider || !workType) return; // Skip rows with missing data

      if (!result[rsm]) {
        result[rsm] = {};
      }

      // Count all records by provider_worktype combination
      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        if (!result[rsm][key]) result[rsm][key] = 0;
        result[rsm][key]++;
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        if (!result[rsm][key]) result[rsm][key] = 0;
        result[rsm][key]++;
      }

      // Count all records by provider totals
      if (!result[rsm][provider]) result[rsm][provider] = 0;
      result[rsm][provider]++;
    });

    console.log('📊 Technician count result:', result);

    return NextResponse.json(result);

  } catch (e: any) {
    console.error('❌ Technician count API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}