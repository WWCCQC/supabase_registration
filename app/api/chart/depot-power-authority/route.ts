export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    
    // Fetch all technicians with depot_name and power_authority
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from("technicians")
        .select("depot_name, power_authority")
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.error("❌ Supabase error:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      
      if (data.length < batchSize) break;
      from += batchSize;
    }
    
    console.log(`📊 Depot Power Authority: Fetched ${allData.length} records from database`);
    
    // Group by depot_name
    const depotMap = new Map<string, { total: number; withPower: number }>();
    
    for (const row of allData) {
      const depotName = (row.depot_name || "").trim();
      const powerAuthority = (row.power_authority || "").trim().toLowerCase();
      
      // Skip empty depot names
      if (!depotName || depotName === "null" || depotName === "undefined") continue;
      
      if (!depotMap.has(depotName)) {
        depotMap.set(depotName, { total: 0, withPower: 0 });
      }
      
      const stats = depotMap.get(depotName)!;
      stats.total++;
      
      // Count "Yes" for power authority
      if (powerAuthority === "yes" || powerAuthority === "y") {
        stats.withPower++;
      }
    }
    
    // Convert to array and calculate percentage
    const rankings = Array.from(depotMap.entries())
      .map(([depotName, stats]) => ({
        depot_name: depotName,
        total_technicians: stats.total,
        with_power_authority: stats.withPower,
        percentage: stats.total > 0 ? ((stats.withPower / stats.total) * 100).toFixed(1) : "0.0"
      }))
      .sort((a, b) => b.with_power_authority - a.with_power_authority) // Sort by power authority count descending
      .slice(0, 10); // Top 10
    
    console.log(`📊 Depot Power Authority Top 10:`, rankings.map(r => `${r.depot_name}: ${r.with_power_authority}/${r.total_technicians}`));
    
    return NextResponse.json({
      rankings,
      totalDepots: depotMap.size,
      totalRecords: allData.length
    });
    
  } catch (error: any) {
    console.error("❌ Depot Power Authority API error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
