import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { mapCtmToThaiName } from "@/lib/ctmMapping";

type TechnicianData = {
  ctm: string;
  provider: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    
    // Get all technicians data with pagination to avoid 1000 record limit
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const to = from + pageSize - 1;
      const { data: pageData, error: pageError } = await supabase
        .from("technicians")
        .select("ctm, provider")
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

    // Group data by CTM and Provider
    const groupedData: { [key: string]: { [provider: string]: number } } = {};
    const providers = new Set<string>();

    (techs as TechnicianData[]).forEach((tech) => {
      const originalCtm = String(tech.ctm || "").trim();
      const provider = String(tech.provider || "").trim();

      // Skip if CTM is empty, null, or contains only whitespace
      if (!originalCtm || originalCtm === "null" || originalCtm === "undefined") return;
      // Skip if provider is empty, null, or contains only whitespace  
      if (!provider || provider === "null" || provider === "undefined") return;

      // Map CTM code to Thai name
      const ctm = mapCtmToThaiName(originalCtm);

      if (!groupedData[ctm]) {
        groupedData[ctm] = {};
      }

      if (!groupedData[ctm][provider]) {
        groupedData[ctm][provider] = 0;
      }

      groupedData[ctm][provider]++;
      providers.add(provider);
    });

    // Convert to chart format and sort by total descending
    const chartData = Object.keys(groupedData)
      .map((ctm) => {
        const item: any = { ctm };
        let total = 0;

        // Add each provider as a property
        providers.forEach((provider) => {
          const count = groupedData[ctm][provider] || 0;
          item[provider] = count;
          total += count;
        });

        item.total = total;
        return item;
      })
      .sort((a, b) => b.total - a.total); // Sort by total descending (มากไปน้อย)

    // Calculate summary
    const summary = {
      totalCtms: Object.keys(groupedData).length,
      totalTechnicians: chartData.reduce((sum, item) => sum + item.total, 0),
      providerBreakdown: Array.from(providers).map((provider) => {
        const count = chartData.reduce((sum, item) => sum + (item[provider] || 0), 0);
        const totalTechs = chartData.reduce((sum, item) => sum + item.total, 0);
        return {
          provider,
          count,
          percentage: totalTechs > 0 ? Math.round((count / totalTechs) * 100) : 0
        };
      })
    };

    console.log('🔍 CTM Provider API Debug:');
    console.log('Total techs:', techs?.length);
    console.log('All data length:', allData.length);
    console.log('Grouped CTMs:', Object.keys(groupedData).length);
    console.log('Chart data length:', chartData.length);
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