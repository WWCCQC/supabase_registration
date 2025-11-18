export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Export ALL technicians without pagination limits
 * Used by Excel export feature
 */
export async function GET(req: Request) {
  try {
    console.log('📥 Export API: Starting full data export...');
    
    const supabase = supabaseAdmin();
    
    // Fetch ALL records using pagination (1000 per batch)
    let allData: any[] = [];
    let page = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const from = page * batchSize;
      const to = from + batchSize - 1;
      
      console.log(`   Fetching batch ${page + 1}: records ${from}-${to}`);
      
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .order("tech_id", { ascending: true, nullsFirst: true })
        .range(from, to);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data);
        console.log(`   ✅ Fetched ${data.length} records (total: ${allData.length})`);
        
        // If we got less than batchSize, we've reached the end
        if (data.length < batchSize) {
          hasMore = false;
        }
        
        page++;
      }
      
      // Safety limit to prevent infinite loop
      if (page > 10) {
        console.warn('⚠️ Safety limit reached (10 pages = 10,000 records)');
        break;
      }
    }
    
    console.log(`✅ Export complete: ${allData.length} total records`);
    
    // Transform data to match the format expected by frontend
    const rows = allData.map((r: any) => ({
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
      power_authority:    r.power_authority    ?? null,
      // Service columns
      svc_install:        r.svc_install        ?? null,
      svc_repair:         r.svc_repair         ?? null,
      svc_ojt:            r.svc_ojt            ?? null,
      svc_safety:         r.svc_safety         ?? null,
      svc_softskill:      r.svc_softskill      ?? null,
      svc_5p:             r.svc_5p             ?? null,
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

    return NextResponse.json({ 
      rows, 
      total: rows.length 
    }, {
      headers: {
        'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'pragma': 'no-cache',
        'expires': '0',
      }
    });
  } catch (e: any) {
    console.error('❌ Export error:', e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
