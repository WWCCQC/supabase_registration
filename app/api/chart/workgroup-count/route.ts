export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    console.log('🔧 Workgroup Count API Environment check:');
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

    // Build base query - MUST match SQL WHERE conditions exactly
    // WHERE rsm IS NOT NULL AND provider IS NOT NULL AND work_type IS NOT NULL
    let query = supabase
      .from("technicians")
      .select("rsm, provider, work_type, workgroup_status, national_id")
      .not("rsm", "is", null)
      .not("provider", "is", null)
      .not("work_type", "is", null);

    console.log('📊 Querying Supabase with WHERE conditions: rsm, provider, work_type NOT NULL...');

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
        console.error('❌ Workgroup count error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      console.log(`📊 Workgroup batch ${page + 1}: ${pageData.length} records, total: ${allData.length}`);
      
      if (pageData.length < pageSize) break;
      page++;
    }

    console.log('📊 Total records fetched:', allData.length);

    // Debug: Check all unique workgroup_status values
    const allStatuses = [...new Set(allData.map((r: any) => r.workgroup_status).filter(Boolean))];
    console.log('📊 All unique workgroup_status values:', allStatuses);
    
    // Count each status
    const statusCounts: Record<string, number> = {};
    allData.forEach((row: any) => {
      const status = row.workgroup_status || "null";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('📊 Status counts:', statusCounts);
    
    // Filter for หัวหน้า (heads) - handle both correct and encoding-corrupted values
    const headsOnly = allData.filter((row: any) => {
      const status = row.workgroup_status || "";
      // Match: "หัวหน้า" OR "หัวหน้���" (encoding issue)
      return status === "หัวหน้า" || status === "หัวหน้���";
    });
    console.log('📊 Total workgroup heads after filtering:', headsOnly.length);
    console.log('📊 Expected from Supabase query: 1787');
    console.log('📊 Difference:', headsOnly.length - 1787);

    // Process data into pivot format - Count UNIQUE national_id (not rows)
    // Use Set to track unique national_id per RSM x Provider x WorkType
    const result: Record<string, Record<string, number>> = {};
    const uniqueSets: Record<string, Record<string, Set<string>>> = {};

    headsOnly.forEach((row: any) => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      const nationalId = row.national_id || "";

      // Skip if no national_id
      if (!nationalId || nationalId === "null" || nationalId === "undefined") return;

      if (!uniqueSets[rsm]) {
        uniqueSets[rsm] = {};
      }

      // Track unique national_id by provider_worktype combination
      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        if (!uniqueSets[rsm][key]) {
          uniqueSets[rsm][key] = new Set<string>();
        }
        uniqueSets[rsm][key].add(nationalId);
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        if (!uniqueSets[rsm][key]) {
          uniqueSets[rsm][key] = new Set<string>();
        }
        uniqueSets[rsm][key].add(nationalId);
      }
    });

    // Convert Sets to counts
    Object.keys(uniqueSets).forEach(rsm => {
      if (!result[rsm]) {
        result[rsm] = {};
      }
      Object.keys(uniqueSets[rsm]).forEach(key => {
        result[rsm][key] = uniqueSets[rsm][key].size;
      });
    });

    // Calculate provider totals AFTER counting unique national_ids
    // Provider Total = Installation + Repair (still counting unique people)
    Object.keys(result).forEach(rsm => {
      const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
      providers.forEach(provider => {
        const installCount = result[rsm][`${provider}_Installation`] || 0;
        const repairCount = result[rsm][`${provider}_Repair`] || 0;
        result[rsm][provider] = installCount + repairCount;
      });
    });

    // Calculate REAL Grand Total (unique national_id across ALL RSMs)
    const grandTotalSet = new Set<string>();
    headsOnly.forEach((row: any) => {
      const nationalId = row.national_id || "";
      if (nationalId && nationalId !== "null" && nationalId !== "undefined") {
        grandTotalSet.add(nationalId);
      }
    });
    const grandTotal = grandTotalSet.size;

    console.log('📊 Workgroup result:', result);
    console.log('📊 Workgroup Grand Total (unique):', grandTotal);
    console.log('📊 Timestamp:', new Date().toISOString());
    console.log('📊 Version: 2.0 - Fixed unique counting');

    return NextResponse.json(
      { 
        data: result, 
        grandTotal,
        timestamp: new Date().toISOString(),
        message: 'Workgroup count calculated from unique national_id'
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );

  } catch (e: any) {
    console.error('❌ Workgroup count API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}