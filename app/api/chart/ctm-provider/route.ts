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
    
    // Count each provider separately using exact matching (like KPI API)
    const mainProviders = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];
    const providerExactCounts: Record<string, number> = {};
    
    // Count each provider with exact match
    for (const provider of mainProviders) {
      const { count, error } = await supabase
        .from("technicians")
        .select("*", { count: "exact", head: true })
        .eq("provider", provider);
      
      if (error) {
        console.error(`CTM Provider count error for ${provider}:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      providerExactCounts[provider] = count || 0;
    }
    
    console.log("Provider exact counts:", providerExactCounts);
    
    // Get all technicians data with pagination to avoid 1000 record limit
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const to = from + pageSize - 1;
      const { data: pageData, error: pageError } = await supabase
        .from("technicians")
        .select("ctm, provider, national_id")  // เพิ่ม national_id
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
      const originalCtm = String(tech.ctm || "").trim();
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

      // Skip if CTM is empty, null, or contains only whitespace (for grouping only)
      if (!originalCtm || originalCtm === "null" || originalCtm === "undefined") return;

      // Map CTM code to Thai name
      const ctm = mapCtmToThaiName(originalCtm);

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

    // Calculate summary using exact counts from database (not from grouped chart data)
    const totalFromExactCounts = Object.values(providerExactCounts).reduce((sum, count) => sum + count, 0);
    
    const summary = {
      totalCtms: Object.keys(groupedData).length,
      totalTechnicians: totalFromExactCounts,  // Use exact counts from database
      providerBreakdown: mainProviders.map((provider) => {
        // Use exact counts from database query
        const count = providerExactCounts[provider] || 0;
        return {
          provider,
          count,
          percentage: totalFromExactCounts > 0 ? Math.round((count / totalFromExactCounts) * 100) : 0
        };
      })
    };

    console.log('🔍 CTM Provider API Debug:');
    console.log('Total techs:', techs?.length);
    console.log('All data length:', allData.length);
    console.log('Provider exact counts:', providerExactCounts);
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