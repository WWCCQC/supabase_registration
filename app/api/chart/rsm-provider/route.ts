export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  console.log("🚀 RSM Provider Chart API called at", new Date().toISOString());
  
  try {
    const supabase = supabaseAdmin();
    
    // Get total count first
    let countQuery = supabase.from("technicians").select("*", { count: "exact", head: true });
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error("RSM Provider Chart count error:", countError);
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    
    // Fetch all data with proper pagination (no nullsFirst issue)
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("rsm, provider, workgroup_status")
        .order("tech_id", { ascending: true })
        .range(from, from + pageSize - 1);
      
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

    // Group data by RSM and Provider using the same logic as KPI API
    const groupedData: Record<string, { "WW-Provider": number; "True Tech": number; "เถ้าแก่เทค": number; "อื่นๆ": number }> = {};
    const providerCount: Record<string, number> = {};
    
    allData.forEach((row: any) => {
      const rsm = String(row.rsm || "").trim();
      const provider = String(row.provider || "").trim();
      
      // Count all providers for debugging (exact matching like KPI API)
      if (provider && provider !== '') {
        providerCount[provider] = (providerCount[provider] || 0) + 1;
      }
      
      if (!rsm) return; // Skip records without RSM
      
      if (!groupedData[rsm]) {
        groupedData[rsm] = { "WW-Provider": 0, "True Tech": 0, "เถ้าแก่เทค": 0, "อื่นๆ": 0 };
      }
      
      // Categorize Provider using exact string comparison like KPI API
      if (provider === "WW-Provider") {
        groupedData[rsm]["WW-Provider"]++;
      } else if (provider === "True Tech") {
        groupedData[rsm]["True Tech"]++;
      } else if (provider === "เถ้าแก่เทค") {
        groupedData[rsm]["เถ้าแก่เทค"]++;
      } else if (provider && provider !== '') {
        groupedData[rsm]["อื่นๆ"]++;
      } else {
        // No provider case (null/undefined/empty)
        groupedData[rsm]["อื่นๆ"]++;
      }
    });
    
    console.log("Provider Debug Counts:", providerCount);

    // Convert to array format for Recharts
    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        rsm,
        "WW-Provider": counts["WW-Provider"],
        "True Tech": counts["True Tech"],
        "เถ้าแก่เทค": counts["เถ้าแก่เทค"],
        "อื่นๆ": counts["อื่นๆ"],
        total: counts["WW-Provider"] + counts["True Tech"] + counts["เถ้าแก่เทค"] + counts["อื่นๆ"]
      }))
      .sort((a, b) => b.total - a.total);

    // Calculate summary using the same data we used for chart (avoid inconsistency)
    const summaryProviders = {
      "WW-Provider": providerCount["WW-Provider"] || 0,
      "True Tech": providerCount["True Tech"] || 0,
      "เถ้าแก่เทค": providerCount["เถ้าแก่เทค"] || 0,
      "อื่นๆ": 0
    };

    console.log(`RSM Provider Chart Summary: Total RSM: ${Object.keys(groupedData).length}`);
    console.log(`✅ Provider totals from actual data: WW-Provider: ${summaryProviders["WW-Provider"]}, True Tech: ${summaryProviders["True Tech"]}, เถ้าแก่เทค: ${summaryProviders["เถ้าแก่เทค"]}`);

    return NextResponse.json(
      { 
        chartData,
        summary: {
          totalRsm: Object.keys(groupedData).length,
          totalTechnicians: totalCount || 0,
          providers: summaryProviders
        }
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
