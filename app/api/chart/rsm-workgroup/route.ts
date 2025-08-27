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
    
    // ตัวแปรสำหรับนับข้อมูลทั้งหมด
    let totalRecords = allData.length;
    let recordsWithRsm = 0;
    let recordsWithoutRsm = 0;
    let recordsWithStatus = 0;
    let recordsWithoutStatus = 0;
    
    allData.forEach((row: any) => {
      const rsm = String(row.rsm || "").trim();
      const status = String(row.workgroup_status || "").toLowerCase().trim();
      
      // นับข้อมูลที่มี/ไม่มี RSM
      if (rsm) {
        recordsWithRsm++;
      } else {
        recordsWithoutRsm++;
      }
      
      // นับข้อมูลที่มี/ไม่มี workgroup_status
      if (status) {
        recordsWithStatus++;
      } else {
        recordsWithoutStatus++;
      }
      
      if (!rsm) return; // ข้ามข้อมูลที่ไม่มี RSM สำหรับการจัดกลุ่ม
      
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
    
    // คำนวณ summary จากข้อมูลทั้งหมด
    const allTotals = Object.values(groupedData);
    const totalLeaders = allTotals.reduce((sum, item) => sum + item.หัวหน้า, 0);
    const totalMembers = allTotals.reduce((sum, item) => sum + item.ลูกน้อง, 0);
    const totalTechniciansWithRsm = totalLeaders + totalMembers;
    
    console.log(`📊 Chart Summary: Total Records: ${totalRecords}, Records with RSM: ${recordsWithRsm}, Records without RSM: ${recordsWithoutRsm}`);
    console.log(`📊 Chart Summary: Records with Status: ${recordsWithStatus}, Records without Status: ${recordsWithoutStatus}`);
    console.log(`📊 Chart Summary: Total RSM: ${Object.keys(groupedData).length}, Total Technicians with RSM: ${totalTechniciansWithRsm}, Leaders: ${totalLeaders}, Members: ${totalMembers}`);

    return NextResponse.json(
      { 
        chartData,
        summary: {
          totalRsm: Object.keys(groupedData).length,           // จำนวน RSM ทั้งหมด
          totalTechnicians: totalRecords,                      // จำนวนช่างทั้งหมด (รวมที่ไม่มี RSM)
          totalTechniciansWithRsm: totalTechniciansWithRsm,    // จำนวนช่างที่มี RSM
          totalLeaders: totalLeaders,                          // จำนวนหัวหน้าทั้งหมด
          totalMembers: totalMembers,                          // จำนวนลูกน้องทั้งหมด
          recordsWithoutRsm: recordsWithoutRsm,                // จำนวนช่างที่ไม่มี RSM
          recordsWithoutStatus: recordsWithoutStatus           // จำนวนช่างที่ไม่มี workgroup_status
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
