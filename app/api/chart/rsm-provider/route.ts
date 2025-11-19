export const dynamic = "force-dynamic";
// Version: 2.0 - Fixed to use exact database counts without filters
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
    
    // Get total count WITHOUT filters (same as CTM Provider API)
    // The legend should show total counts, not filtered counts
    const { count: totalCount, error: countError } = await supabase
      .from("technicians")
      .select("*", { count: "exact", head: true });
    
    if (countError) {
      console.error("RSM Provider Chart count error:", countError);
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    
    // Initialize provider counts
    const providers = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];
    const providerExactCounts: Record<string, number> = {};
    
    // Count each provider with exact match WITHOUT filters (like KPI API and CTM Provider API)
    // This ensures legend shows total count from database, not filtered count
    console.log('🔍 STARTING PROVIDER COUNT (WITHOUT FILTERS)...');
    for (const provider of providers) {
      const { count, error } = await supabase
        .from("technicians")
        .select("*", { count: "exact", head: true })
        .eq("provider", provider);
      
      if (error) {
        console.error(`RSM Provider count error for ${provider}:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      providerExactCounts[provider] = count || 0;
      console.log(`📊 ${provider}: ${count} records in database`);
    }
    
    console.log("=" .repeat(60));
    console.log("🎯 PROVIDER EXACT COUNTS (UNFILTERED):");
    console.log("   WW-Provider:", providerExactCounts["WW-Provider"]);
    console.log("   True Tech:", providerExactCounts["True Tech"]);
    console.log("   เถ้าแก่เทค:", providerExactCounts["เถ้าแก่เทค"]);
    console.log("=" .repeat(60));
    
    // Fetch all data WITHOUT filters for accurate provider counting
    // Filters should not affect the legend numbers (same as CTM Provider API)
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("rsm, provider, workgroup_status, national_id")
        .order("tech_id", { ascending: true })
        .range(from, from + pageSize - 1);
      
      // NO FILTERS - We want all data for accurate counting
      
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
      
      // Skip records without provider
      if (!provider || provider === "null" || provider === "undefined") return;
      
      // Use "No RSM" for records without RSM (same logic as CTM chart using "No CTM")
      const rsmKey = (!rsm || rsm === "null" || rsm === "undefined") ? "No RSM" : rsm;
      
      if (!groupedData[rsmKey]) {
        groupedData[rsmKey] = { 
          "WW-Provider": new Set<string>(), 
          "True Tech": new Set<string>(), 
          "เถ้าแก่เทค": new Set<string>() 
        };
      }
      
      // Use national_id if available, otherwise use row.id to ensure every record is counted
      const uniqueKey = (nationalId && nationalId !== "null" && nationalId !== "undefined") 
        ? nationalId 
        : `id_${row.id}`;
      
      // Categorize Provider using exact string comparison and unique national_id counting
      if (provider === "WW-Provider") {
        groupedData[rsmKey]["WW-Provider"].add(uniqueKey);
        providerSets["WW-Provider"].add(uniqueKey);
      } else if (provider === "True Tech") {
        groupedData[rsmKey]["True Tech"].add(uniqueKey);
        providerSets["True Tech"].add(uniqueKey);
      } else if (provider === "เถ้าแก่เทค") {
        groupedData[rsmKey]["เถ้าแก่เทค"].add(uniqueKey);
        providerSets["เถ้าแก่เทค"].add(uniqueKey);
      }
      // Note: Other providers are not counted
    });
    
    // Sample True Tech records for debugging
    const trueTechSample = allData.filter((row: any) => {
      const provider = String(row.provider || "").trim();
      return provider === "True Tech";
    }).slice(0, 5);
    console.log(`📊 Sample True Tech records (${trueTechSample.length}):`, trueTechSample.map((r: any) => ({
      provider: r.provider,
      rsm: r.rsm,
      national_id: r.national_id
    })));

    // Calculate provider counts from Sets (for chart display)
    const providerSetCounts = {
      "WW-Provider": providerSets["WW-Provider"].size,
      "True Tech": providerSets["True Tech"].size,
      "เถ้าแก่เทค": providerSets["เถ้าแก่เทค"].size
    };

    console.log("🔍 Provider counts from Sets (chart data):", providerSetCounts);
    console.log("🎯 Provider exact counts (for legend):", providerExactCounts);
    console.log(`🔍 Set count for True Tech: ${providerSetCounts["True Tech"]}`);
    console.log(`🎯 Exact count for True Tech: ${providerExactCounts["True Tech"]}`);

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

    // Calculate summary from grouped data (unique national_id counts - same as chart)
    // This ensures summary and chart show the same numbers
    const totalFromSetCounts = Object.values(providerSetCounts).reduce((sum, count) => sum + count, 0);
    
    const summary = {
      totalRsm: Object.keys(groupedData).length,
      totalTechnicians: totalCount || 0,
      providerBreakdown: providers.map((provider) => {
        // Use counts from Sets (same as chart) instead of exact database counts
        const count = (providerSetCounts as any)[provider] || 0;
        console.log(`📊 Building summary for ${provider}: count = ${count} (from providerSetCounts - unique national_id)`);
        return {
          provider,
          count,
          percentage: totalFromSetCounts > 0 ? Math.round((count / totalFromSetCounts) * 100) : 0
        };
      }),
      // Keep old format for backward compatibility - use Set counts
      providers: providerSetCounts
    };

    console.log("=" .repeat(60));
    console.log("📊 FINAL SUMMARY TO BE SENT:");
    console.log("=" .repeat(60));
    summary.providerBreakdown.forEach(p => {
      console.log(`   ${p.provider}: ${p.count} (${p.percentage}%)`);
    });
    console.log("Difference (direct DB count vs unique national_id):");
    console.log(`   WW-Provider: ${(providerExactCounts['WW-Provider'] || 0) - (providerSetCounts['WW-Provider'] || 0)}`);
    console.log(`   True Tech: ${(providerExactCounts['True Tech'] || 0) - (providerSetCounts['True Tech'] || 0)}`);
    console.log(`   เถ้าแก่เทค: ${(providerExactCounts['เถ้าแก่เทค'] || 0) - (providerSetCounts['เถ้าแก่เทค'] || 0)}`);
    console.log("=" .repeat(60));
    
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
