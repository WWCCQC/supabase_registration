export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    
    // ดึงข้อมูลทั้งหมดโดยใช้วิธีเดียวกับ Chart API อื่นๆ
    // 1. Query สำหรับนับจำนวนทั้งหมด
    let countQuery = supabase.from("technicians").select("*", { count: "exact", head: true });
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error("RSM Provider Chart count error:", countError);
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    
    // 2. Query สำหรับดึงข้อมูลจริง
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let dataQuery = supabase.from("technicians").select("rsm, provider");
      dataQuery = dataQuery.order("national_id", { ascending: true, nullsFirst: true }).range(from, from + pageSize - 1);
      
      const { data, error } = await dataQuery;
      
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
    
    console.log(`📊 RSM Provider Chart API: Fetched ${allData?.length || 0} records from database (DB count: ${totalCount || 0})`);

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

    // จัดกลุ่มข้อมูลตาม RSM และ Provider
    const groupedData: Record<string, { "WW-Provider": number; "True Tech": number; "เถ้าแก่เทค": number; "อื่นๆ": number }> = {};
    
    allData.forEach((row: any) => {
      const rsm = String(row.rsm || "").trim();
      const provider = String(row.provider || "").trim();
      
      if (!rsm) return; // ข้ามข้อมูลที่ไม่มี RSM
      
      if (!groupedData[rsm]) {
        groupedData[rsm] = { "WW-Provider": 0, "True Tech": 0, "เถ้าแก่เทค": 0, "อื่นๆ": 0 };
      }
      
      // จัดประเภท Provider
      if (provider.toLowerCase().includes("ww") || provider.toLowerCase().includes("provider")) {
        groupedData[rsm]["WW-Provider"]++;
      } else if (provider.toLowerCase().includes("true tech")) {
        groupedData[rsm]["True Tech"]++;
      } else if (provider.includes("เถ้าแก่เทค") || provider.toLowerCase().includes("tao")) {
        groupedData[rsm]["เถ้าแก่เทค"]++;
      } else if (provider) {
        groupedData[rsm]["อื่นๆ"]++;
      } else {
        // กรณีไม่มี provider ให้นับเป็น อื่นๆ
        groupedData[rsm]["อื่นๆ"]++;
      }
    });

    // แปลงเป็น array format สำหรับ Recharts
    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        rsm,
        "WW-Provider": counts["WW-Provider"],
        "True Tech": counts["True Tech"],
        "เถ้าแก่เทค": counts["เถ้าแก่เทค"],
        "อื่นๆ": counts["อื่นๆ"],
        total: counts["WW-Provider"] + counts["True Tech"] + counts["เถ้าแก่เทค"] + counts["อื่นๆ"]
      }))
      .sort((a, b) => b.total - a.total); // เรียงตาม total มากไปน้อย

    // คำนวณ summary
    const allTotals = Object.values(groupedData);
    const totalWWProvider = allTotals.reduce((sum, item) => sum + item["WW-Provider"], 0);
    const totalTrueTech = allTotals.reduce((sum, item) => sum + item["True Tech"], 0);
    const totalTaoKae = allTotals.reduce((sum, item) => sum + item["เถ้าแก่เทค"], 0);
    const totalOthers = allTotals.reduce((sum, item) => sum + item["อื่นๆ"], 0);
    
    console.log(`📊 RSM Provider Chart Summary: Total RSM: ${Object.keys(groupedData).length}`);
    console.log(`📊 Providers: WW-Provider: ${totalWWProvider}, True Tech: ${totalTrueTech}, เถ้าแก่เทค: ${totalTaoKae}, อื่นๆ: ${totalOthers}`);

    return NextResponse.json(
      { 
        chartData,
        summary: {
          totalRsm: Object.keys(groupedData).length,
          totalTechnicians: totalCount || 0,
          providers: {
            "WW-Provider": totalWWProvider,
            "True Tech": totalTrueTech,
            "เถ้าแก่เทค": totalTaoKae,
            "อื่นๆ": totalOthers
          }
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
