export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    
    // ดึงข้อมูลทั้งหมดโดยไม่จำกัดจำนวน
    // ใช้วิธี paginate เพื่อดึงข้อมูลทั้งหมด
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("rsm, workgroup_status")
        .not("rsm", "is", null)
        .not("rsm", "eq", "")
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error("Chart data fetch error:", error);
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
    
    console.log(`📊 Chart API: Fetched ${allData.length} total records`);

    // จัดกลุ่มข้อมูลตาม RSM และ workgroup_status
    const groupedData: Record<string, { หัวหน้า: number; ลูกน้อง: number }> = {};
    
    allData.forEach((row: any) => {
      const rsm = String(row.rsm || "").trim();
      const status = String(row.workgroup_status || "").toLowerCase().trim();
      
      if (!rsm) return;
      
      if (!groupedData[rsm]) {
        groupedData[rsm] = { หัวหน้า: 0, ลูกน้อง: 0 };
      }
      
      // แปลง workgroup_status เป็น หัวหน้า/ลูกน้อง
      // ตรวจสอบค่าต่างๆ ที่อาจหมายถึงหัวหน้า
      if (status.includes("หัวหน้า") || 
          status.includes("leader") || 
          status === "l" || 
          status === "หน." ||
          status.includes("head")) {
        groupedData[rsm].หัวหน้า++;
      } else if (status) {
        // ถ้ามี status แต่ไม่ใช่หัวหน้า = ลูกน้อง
        groupedData[rsm].ลูกน้อง++;
      }
    });

    // แปลงเป็น array format สำหรับ Recharts
    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        rsm,
        หัวหน้า: counts.หัวหน้า,
        ลูกน้อง: counts.ลูกน้อง,
        total: counts.หัวหน้า + counts.ลูกน้อง
      }))
      .sort((a, b) => b.total - a.total) // เรียงตาม total มากไปน้อย
      .slice(0, 20); // แสดงแค่ top 20 RSM
    
    // คำนวณ summary จากข้อมูลทั้งหมด ไม่ใช่แค่ top 20
    const allTotals = Object.values(groupedData);
    const totalLeaders = allTotals.reduce((sum, item) => sum + item.หัวหน้า, 0);
    const totalMembers = allTotals.reduce((sum, item) => sum + item.ลูกน้อง, 0);
    const totalTechnicians = totalLeaders + totalMembers;
    
    console.log(`📊 Chart Summary: Total RSM: ${Object.keys(groupedData).length}, Total Technicians: ${totalTechnicians}, Leaders: ${totalLeaders}, Members: ${totalMembers}`);

    return NextResponse.json(
      { 
        chartData,
        summary: {
          totalRsm: Object.keys(groupedData).length, // จำนวน RSM ทั้งหมด
          totalTechnicians: totalTechnicians,        // จำนวนช่างทั้งหมด
          totalLeaders: totalLeaders,                // จำนวนหัวหน้าทั้งหมด
          totalMembers: totalMembers                 // จำนวนลูกน้องทั้งหมด
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
    console.error("Chart API error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
