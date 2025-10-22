export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function sanitize(s?: string | null) {
  if (!s) return '';
  return s.replace(/[,%]/g, ' ').trim();
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
      'national_id', 'tech_id', 'full_name', 'gender', 'degree',
      'area', 'rsm', 'ctm', 'depot_code', 'provider', 'work_type', 'workgroup_status'
    ];
    query = (query as any).or(cols.map(c => `${c}.ilike.%${q}%`).join(','));
  }

  return query;
}

export async function GET(req: Request) {
  console.log("🚀 RSM Provider Chart API called at", new Date().toISOString());
  
  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    const supabase = supabaseAdmin();
    
    // Get total count first with filters applied to match KPI API
    let countQuery = supabase.from("technicians").select("*", { count: "exact", head: true });
    countQuery = applyFilters(countQuery, params);
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error("RSM Provider Chart count error:", countError);
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    
    // Initialize provider counts
    const providers = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];
    const providerExactCounts: Record<string, number> = {};
    
    // Count each provider with exact match (like KPI API)
    for (const provider of providers) {
      let exactQuery = supabase
        .from("technicians")
        .select("*", { count: "exact", head: true })
        .eq("provider", provider);
      
      exactQuery = applyFilters(exactQuery, params);
      const { count, error } = await exactQuery;
      
      if (error) {
        console.error(`RSM Provider count error for ${provider}:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      providerExactCounts[provider] = count || 0;
    }
    
    console.log("Provider exact counts from database:", providerExactCounts);
    
    // Fetch all data with proper pagination for chart grouping - include national_id for unique counting
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from("technicians")
        .select("rsm, provider, workgroup_status, national_id")
        .order("tech_id", { ascending: true })
        .range(from, from + pageSize - 1);
        
      query = applyFilters(query, params);
      const { data, error } = await query;
      
      if (error) {
        console.error("RSM Provider Chart data fetch error:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`RSM Provider Chart API: Fetched ${allData?.length || 0} records from database (DB count: ${totalCount || 0}) - Updated: ${new Date().toISOString()}`);

    if (!allData || allData.length === 0) {
      return NextResponse.json({ 
        chartData: [], 
        summary: {
          totalRsm: 0,
          totalTechnicians: 0,
          providers: {}
        }
      });
    }

    // Group data by RSM and Provider for chart display using UNIQUE national_id counting
    const groupedData: Record<string, { "WW-Provider": Set<string>; "True Tech": Set<string>; "เถ้าแก่เทค": Set<string> }> = {};
    const providerSets = {
      "WW-Provider": new Set<string>(),
      "True Tech": new Set<string>(),
      "เถ้าแก่เทค": new Set<string>()
    };
    
    allData.forEach((row: any) => {
      const rsm = String(row.rsm || "").trim();
      const provider = String(row.provider || "").trim();
      const nationalId = String(row.national_id || "").trim();
      
      // Skip records without RSM or national_id
      if (!rsm || rsm === "null" || rsm === "undefined") return;
      if (!nationalId || nationalId === "null" || nationalId === "undefined") return;
      
      // Skip records without provider
      if (!provider || provider === "null" || provider === "undefined") return;
      
      if (!groupedData[rsm]) {
        groupedData[rsm] = { 
          "WW-Provider": new Set<string>(), 
          "True Tech": new Set<string>(), 
          "เถ้าแก่เทค": new Set<string>() 
        };
      }
      
      // Categorize Provider using exact string comparison and unique national_id counting
      if (provider === "WW-Provider") {
        groupedData[rsm]["WW-Provider"].add(nationalId);
        providerSets["WW-Provider"].add(nationalId);
      } else if (provider === "True Tech") {
        groupedData[rsm]["True Tech"].add(nationalId);
        providerSets["True Tech"].add(nationalId);
      } else if (provider === "เถ้าแก่เทค") {
        groupedData[rsm]["เถ้าแก่เทค"].add(nationalId);
        providerSets["เถ้าแก่เทค"].add(nationalId);
      }
      // Note: Other providers are not counted
    });

    // Calculate provider counts from Sets (for chart display)
    const providerSetCounts = {
      "WW-Provider": providerSets["WW-Provider"].size,
      "True Tech": providerSets["True Tech"].size,
      "เถ้าแก่เทค": providerSets["เถ้าแก่เทค"].size
    };

    console.log("Provider counts from Sets (chart data):", providerSetCounts);
    console.log("Provider exact counts (for legend):", providerExactCounts);

    // Convert to array format for Recharts
    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        rsm,
        "WW-Provider": counts["WW-Provider"].size,
        "True Tech": counts["True Tech"].size,
        "เถ้าแก่เทค": counts["เถ้าแก่เทค"].size,
        total: counts["WW-Provider"].size + counts["True Tech"].size + counts["เถ้าแก่เทค"].size
      }))
      .sort((a, b) => b.total - a.total);

    // Calculate summary using exact provider counts (like KPI API and CTM Provider Chart)
    const totalMainProviders = Object.values(providerExactCounts).reduce((sum, count) => sum + count, 0);
    
    const summary = {
      totalRsm: Object.keys(groupedData).length,
      totalTechnicians: totalCount || 0,
      providerBreakdown: providers.map((provider) => {
        // Use exact counts from database query (like KPI API)
        const count = providerExactCounts[provider] || 0;
        return {
          provider,
          count,
          percentage: totalMainProviders > 0 ? Math.round((count / totalMainProviders) * 100) : 0
        };
      }),
      // Keep old format for backward compatibility
      providers: providerExactCounts
    };

    console.log(`RSM Provider Chart Summary: Total RSM: ${Object.keys(groupedData).length}`);
    console.log(`✅ Provider totals from exact counts: WW-Provider: ${providerExactCounts["WW-Provider"]}, True Tech: ${providerExactCounts["True Tech"]}, เถ้าแก่เทค: ${providerExactCounts["เถ้าแก่เทค"]}`);

    return NextResponse.json(
      { 
        chartData,
        summary
      },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
          "pragma": "no-cache",
          "expires": "0",
        },
      }
    );
  } catch (e: any) {
    console.error("RSM Provider Chart API error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
