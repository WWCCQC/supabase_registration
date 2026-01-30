export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';
// Version: 3.2 - Added fetchCache for complete cache prevention
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  console.log("🚀 RSM Provider Chart API called at", new Date().toISOString());
  
  try {
    const supabase = supabaseAdmin();
    
    const providers = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];
    
    // Get total counts using pagination to avoid timeout
    console.log("📊 Counting providers with pagination...");
    const providerTotals: Record<string, number> = {};
    
    for (const provider of providers) {
      // Use pagination to fetch all records without timeout
      const allIds = new Set<string>();
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: ids } = await supabase
          .from("technicians")
          .select("national_id")
          .eq("provider", provider)
          .not("national_id", "is", null)
          .range(from, from + pageSize - 1);
        
        if (ids && ids.length > 0) {
          ids.forEach(r => allIds.add(r.national_id));
          from += pageSize;
          hasMore = ids.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      providerTotals[provider] = allIds.size;
      console.log(`   ${provider}: ${providerTotals[provider]} (paginated COUNT DISTINCT)`);
    }
    
    // Get RBM distribution using pagination
    console.log("📊 Grouping by RBM with pagination...");
    const allRsmData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: rsmDataRaw } = await supabase
        .from("technicians")
        .select("RBM, provider, national_id")
        .not("national_id", "is", null)
        .in("provider", providers)
        .range(from, from + pageSize - 1);
      
      if (rsmDataRaw && rsmDataRaw.length > 0) {
        allRsmData.push(...rsmDataRaw);
        from += pageSize;
        hasMore = rsmDataRaw.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Fetched ${allRsmData.length} records total`);
    console.log(`📊 Fetched ${allRsmData.length} records total`);
    
    const groupedData: Record<string, Record<string, number>> = {};
    const tempSets: Record<string, Record<string, Set<string>>> = {};
    
    allRsmData.forEach((row: any) => {
      const rsm = row.RBM || "No RBM";
      const provider = row.provider;
      const nationalId = row.national_id;
      
      if (!tempSets[rsm]) {
        tempSets[rsm] = {
          "WW-Provider": new Set(),
          "True Tech": new Set(),
          "เถ้าแก่เทค": new Set()
        };
      }
      
      if (tempSets[rsm][provider]) {
        tempSets[rsm][provider].add(nationalId);
      }
    });
    
    // Convert Sets to counts
    Object.keys(tempSets).forEach(rsm => {
      groupedData[rsm] = {
        "WW-Provider": tempSets[rsm]["WW-Provider"].size,
        "True Tech": tempSets[rsm]["True Tech"].size,
        "เถ้าแก่เทค": tempSets[rsm]["เถ้าแก่เทค"].size
      };
    });    
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

    // Calculate summary using providerTotals from direct SQL count
    const totalFromCounts = providerTotals["WW-Provider"] + providerTotals["True Tech"] + providerTotals["เถ้าแก่เทค"];
    
    const summary = {
      totalRsm: Object.keys(groupedData).length,
      totalTechnicians: totalFromCounts,
      providerBreakdown: providers.map((provider) => {
        const count = providerTotals[provider] || 0;
        return {
          provider,
          count,
          percentage: totalFromCounts > 0 ? Math.round((count / totalFromCounts) * 100) : 0
        };
      }),
      providers: {
        "WW-Provider": providerTotals["WW-Provider"] || 0,
        "True Tech": providerTotals["True Tech"] || 0,
        "เถ้าแก่เทค": providerTotals["เถ้าแก่เทค"] || 0
      }
    };

    console.log("=" .repeat(60));
    console.log("📊 FINAL SUMMARY (using SQL counts):");
    console.log("=" .repeat(60));
    summary.providerBreakdown.forEach(p => {
      console.log(`   ${p.provider}: ${p.count} (${p.percentage}%)`);
    });
    console.log("=" .repeat(60));
    console.log(`⏰ Response generated at: ${new Date().toISOString()}`);
    
    return NextResponse.json(
      { 
        chartData,
        summary,
        _timestamp: new Date().toISOString(),
        _version: "3.1-fixed-limit"
      },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
          "pragma": "no-cache",
          "expires": "0",
          "x-timestamp": new Date().toISOString(),
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
