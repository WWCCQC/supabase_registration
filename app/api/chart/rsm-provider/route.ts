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
        .select("tech_id, rsm, provider, workgroup_status, national_id")
        .order("tech_id", { ascending: true })
        .range(from, from + pageSize - 1);
      
      // NO FILTERS - We want all data for accurate counting (including records with null values)
      
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
    
    // Debug: Count True Tech in fetched data
    const trueTechInData = allData.filter((r: any) => {
      const provider = String(r.provider || "").trim();
      return provider === "True Tech";
    }).length;
    console.log(`🔍 Debug: True Tech records in fetched data: ${trueTechInData} (Expected from DB: ${providerExactCounts["True Tech"] || 0})`);

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

    // Group data by RSM and Provider - Count unique national_id (same as CTM Provider API)
    const groupedData: Record<string, { "WW-Provider": number; "True Tech": number; "เถ้าแก่เทค": number }> = {};
    const providerCounts = {
      "WW-Provider": 0,
      "True Tech": 0,
      "เถ้าแก่เทค": 0
    };
    
    // Debug: count all unique providers
    const allProvidersInData: Record<string, number> = {};
    
    allData.forEach((row: any) => {
      const rsm = String(row.rsm || "").trim();
      const provider = String(row.provider || "").trim();
      const nationalId = row.national_id;
      
      // Skip records without national_id (same as CTM Provider API)
      if (!nationalId) return;
      
      // Track all providers for debugging
      const providerKey = provider || "(empty/null)";
      allProvidersInData[providerKey] = (allProvidersInData[providerKey] || 0) + 1;
      
      // Skip records without provider
      if (!provider || provider === "null" || provider === "undefined") return;
      
      // Use "No RSM" for records without RSM
      const rsmKey = (!rsm || rsm === "null" || rsm === "undefined") ? "No RSM" : rsm;
      
      if (!groupedData[rsmKey]) {
        groupedData[rsmKey] = { 
          "WW-Provider": 0, 
          "True Tech": 0, 
          "เถ้าแก่เทค": 0
        };
      }
      
      // Categorize Provider using exact string comparison - count rows with valid national_id
      if (provider === "WW-Provider") {
        groupedData[rsmKey]["WW-Provider"]++;
        providerCounts["WW-Provider"]++;
      } else if (provider === "True Tech") {
        groupedData[rsmKey]["True Tech"]++;
        providerCounts["True Tech"]++;
      } else if (provider === "เถ้าแก่เทค") {
        groupedData[rsmKey]["เถ้าแก่เทค"]++;
        providerCounts["เถ้าแก่เทค"]++;
      }
      // Note: Other providers are not counted
    });

    console.log("🔍 All unique providers in data (with national_id):", allProvidersInData);
    console.log("🔍 Provider counts (direct row counting with national_id):", providerCounts);
    console.log("🎯 Provider exact counts (from DB):", providerExactCounts);

    // Convert to array format for Recharts
    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        rsm,
        "WW-Provider": counts["WW-Provider"],
        "True Tech": counts["True Tech"],
        "เถ้าแก่เทค": counts["เถ้าแก่เทค"],
        total: counts["WW-Provider"] + counts["True Tech"] + counts["เถ้าแก่เทค"]
      }))
      .sort((a, b) => b.total - a.total);

    // Calculate summary from grouped data (direct row counting)
    const totalFromCounts = providerCounts["WW-Provider"] + providerCounts["True Tech"] + providerCounts["เถ้าแก่เทค"];
    
    const summary = {
      totalRsm: Object.keys(groupedData).length,
      totalTechnicians: totalCount || 0,
      providerBreakdown: providers.map((provider) => {
        const count = (providerCounts as any)[provider] || 0;
        console.log(`📊 Building summary for ${provider}: count = ${count}`);
        return {
          provider,
          count,
          percentage: totalFromCounts > 0 ? Math.round((count / totalFromCounts) * 100) : 0
        };
      }),
      providers: providerCounts
    };

    console.log("=" .repeat(60));
    console.log("📊 FINAL SUMMARY:");
    console.log("=" .repeat(60));
    summary.providerBreakdown.forEach(p => {
      console.log(`   ${p.provider}: ${p.count} (${p.percentage}%)`);
    });
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
