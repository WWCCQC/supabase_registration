export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { mapCtmToThaiName } from "@/lib/ctmMapping";

type TechnicianData = {
  ctm: string;
  provider: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    
    // Count each provider using unique national_id (like RSM Provider API)
    const mainProviders = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];
    const providerExactCounts: Record<string, number> = {};
    
    console.log("📊 CTM Provider: Counting with pagination...");
    
    // Count unique national_id for each provider using pagination
    for (const provider of mainProviders) {
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
      
      providerExactCounts[provider] = allIds.size;
      console.log(`   ${provider}: ${allIds.size} (unique national_id)`);
    }
    
    console.log("Provider exact counts (unique national_id):", providerExactCounts);
    
    // Get all technicians data with pagination to avoid 1000 record limit
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const to = from + pageSize - 1;
      const { data: pageData, error: pageError } = await supabase
        .from("technicians")
        .select("CBM, provider, national_id")  // เพิ่ม national_id
        .range(from, to);
        
      if (pageError) {
        console.error("Supabase pagination error:", pageError);
        return NextResponse.json({ error: pageError.message }, { status: 500 });
      }
      
      if (pageData && pageData.length > 0) {
        allData.push(...pageData);
        from += pageSize;
        hasMore = pageData.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    const techs = allData;

    // Group data by CTM and Provider - Count unique national_id
    const groupedData: { [key: string]: { [provider: string]: Set<string> } } = {};
    const providers = new Set<string>();

    (techs as any[]).forEach((tech) => {
      const originalCtm = String(tech.CBM || "").trim();
      const provider = String(tech.provider || "").trim();
      const nationalId = tech.national_id;

      // Skip if national_id is missing
      if (!nationalId) return;

      // Skip if provider is empty, null, or contains only whitespace  
      if (!provider || provider === "null" || provider === "undefined") return;
      
      // Only add the 3 main providers to the set
      if (mainProviders.includes(provider)) {
        providers.add(provider);
      }

      // Map CTM code to Thai name (use "No CTM" for missing values)
      const ctm = (!originalCtm || originalCtm === "null" || originalCtm === "undefined") 
        ? "No CTM" 
        : mapCtmToThaiName(originalCtm);

      if (!groupedData[ctm]) {
        groupedData[ctm] = {};
      }

      if (!groupedData[ctm][provider]) {
        groupedData[ctm][provider] = new Set();
      }

      // Add national_id to Set (automatically handles duplicates)
      groupedData[ctm][provider].add(nationalId);
    });

    // Convert to chart format and sort by total descending
    const chartData = Object.keys(groupedData)
      .map((ctm) => {
        const item: any = { ctm };
        let total = 0;

        // Add each provider as a property - convert Set to count
        providers.forEach((provider) => {
          const count = groupedData[ctm][provider]?.size || 0;
          item[provider] = count;
          total += count;
        });

        item.total = total;
        return item;
      })
      .sort((a, b) => b.total - a.total); // Sort by total descending (มากไปน้อย)

    // Calculate summary from grouped data (unique national_id counts - same as chart)
    // This ensures summary and chart show the same numbers
    const providerCountsFromGroupedData: Record<string, number> = {};
    
    mainProviders.forEach(provider => {
      let totalForProvider = 0;
      Object.keys(groupedData).forEach(ctm => {
        totalForProvider += groupedData[ctm][provider]?.size || 0;
      });
      providerCountsFromGroupedData[provider] = totalForProvider;
    });
    
    const totalFromGroupedData = Object.values(providerCountsFromGroupedData).reduce((sum, count) => sum + count, 0);
    
    const summary = {
      totalCtms: Object.keys(groupedData).length,
      totalTechnicians: totalFromGroupedData,  // Use counts from grouped data (unique national_id)
      providerBreakdown: mainProviders.map((provider) => {
        // Use counts from grouped data (same as chart)
        const count = providerCountsFromGroupedData[provider] || 0;
        return {
          provider,
          count,
          percentage: totalFromGroupedData > 0 ? Math.round((count / totalFromGroupedData) * 100) : 0
        };
      })
    };

    console.log('🔍 CTM Provider API Debug:');
    console.log('Total techs:', techs?.length);
    console.log('All data length:', allData.length);
    console.log('Provider exact counts (direct DB count):', providerExactCounts);
    console.log('Provider counts from grouped data (unique national_id):', providerCountsFromGroupedData);
    console.log('Difference (records without national_id or duplicates):', {
      'WW-Provider': (providerExactCounts['WW-Provider'] || 0) - (providerCountsFromGroupedData['WW-Provider'] || 0),
      'True Tech': (providerExactCounts['True Tech'] || 0) - (providerCountsFromGroupedData['True Tech'] || 0),
      'เถ้าแก่เทค': (providerExactCounts['เถ้าแก่เทค'] || 0) - (providerCountsFromGroupedData['เถ้าแก่เทค'] || 0),
    });
    console.log('Grouped CTMs:', Object.keys(groupedData).length);
    console.log('Chart data length:', chartData.length);
    console.log('Summary provider breakdown:', summary.providerBreakdown);
    console.log('Top 10 CTMs:', chartData.slice(0, 10).map(item => `${item.ctm}: ${item.total}`));
    
    // Debug CTM mapping
    const sampleMappings = chartData.slice(0, 5).map(item => item.ctm);
    console.log('🔤 Sample mapped CTM names:', sampleMappings);
    
    return NextResponse.json({
      chartData,
      summary,
      providers: Array.from(providers).sort()
    });

  } catch (error) {
    console.error("CTM Provider chart error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}