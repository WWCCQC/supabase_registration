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

    // Get total count of "หัวหน้า" first (for accurate grand total)
    let countQuery = supabase
      .from("technicians")
      .select("*", { count: "exact", head: true })
      .not("rsm", "is", null)
      .not("provider", "is", null)
      .not("work_type", "is", null)
      .eq("workgroup_status", "หัวหน้า");
    
    const { count: totalHeadsCount } = await countQuery;
    console.log('📊 Total หัวหน้า count from DB:', totalHeadsCount);

    // Build base query - MUST match SQL WHERE conditions exactly
    // WHERE rsm IS NOT NULL AND provider IS NOT NULL AND work_type IS NOT NULL
    let query = supabase
      .from("technicians")
      .select("rsm, provider, work_type, workgroup_status, national_id, tech_id")
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
    
    // Filter for หัวหน้า (heads) - any status starting with "ห" to handle encoding issues
    const headsOnly = allData.filter((row: any) => {
      const status = row.workgroup_status || "";
      // Match any status that starts with "ห" (covers หัวหน้า and หัวหน���า)
      return status.startsWith("ห");
    });
    console.log('📊 Total workgroup heads after filtering:', headsOnly.length);
    console.log('📊 Expected from Supabase query: 1787');
    console.log('📊 Difference:', headsOnly.length - 1787);

    // Process data into pivot format - Count ALL records (not unique national_id)
    const result: Record<string, Record<string, number>> = {};

    headsOnly.forEach((row: any) => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";

      if (!result[rsm]) {
        result[rsm] = {};
      }

      // Count all records by provider_worktype combination
      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        if (!result[rsm][key]) {
          result[rsm][key] = 0;
        }
        result[rsm][key]++;
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        if (!result[rsm][key]) {
          result[rsm][key] = 0;
        }
        result[rsm][key]++;
      }
    });

    // Calculate provider totals by summing Installation + Repair
    Object.keys(result).forEach(rsm => {
      const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
      providers.forEach(provider => {
        const installCount = result[rsm][`${provider}_Installation`] || 0;
        const repairCount = result[rsm][`${provider}_Repair`] || 0;
        result[rsm][provider] = installCount + repairCount;
      });
    });

    // Calculate Grand Total from all records
    const grandTotal = headsOnly.length;

    console.log('📊 Workgroup result:', result);
    console.log('📊 Workgroup Grand Total (calculated from fetched data):', grandTotal);
    console.log('📊 Workgroup Grand Total (from DB count):', totalHeadsCount);
    
    // ⚠️ Warning if counts don't match
    if (totalHeadsCount && grandTotal !== totalHeadsCount) {
      console.warn(`⚠️  Warning: Calculated ${grandTotal} but DB count is ${totalHeadsCount} (missing ${totalHeadsCount - grandTotal} records)`);
    }
    
    console.log('📊 Timestamp:', new Date().toISOString());
    console.log('📊 Version: 4.0 - Count all workgroup head records');

    return NextResponse.json(
      { 
        data: result, 
        grandTotal: totalHeadsCount || grandTotal, // Use DB count as primary source
        timestamp: new Date().toISOString(),
        message: 'Workgroup count calculated from all records (not unique)',
        _debug: {
          dbCount: totalHeadsCount,
          calculatedCount: grandTotal,
          fetchedRows: allData.length,
          headsOnlyRows: headsOnly.length,
          discrepancy: totalHeadsCount ? totalHeadsCount - grandTotal : 0
        }
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
