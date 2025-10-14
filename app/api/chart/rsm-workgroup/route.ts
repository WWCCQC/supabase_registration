export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    
    // Get total count first
    let countQuery = supabase.from("technicians").select("*", { count: "exact", head: true });
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error("RSM Workgroup Chart count error:", countError);
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    
    // Fetch all data with proper pagination including national_id for unique counting
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("rsm, provider, workgroup_status, national_id")
        .order("tech_id", { ascending: true })
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error("RSM Workgroup Chart data fetch error:", error);
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

    console.log(`📊 Chart API: Fetched ${allData?.length || 0} records from database (DB count: ${totalCount || 0}) - Fixed encoding issue`);
    console.log(`📊 Chart API: Using actual fetched count (${allData?.length || 0}) for consistency with Table Editor`);

    if (!allData || allData.length === 0) {
      return NextResponse.json({ 
        chartData: [], 
        summary: {
          totalRsm: 0,
          totalTechnicians: totalCount || 0,  // ใช้ totalCount แทน 0
          totalTechniciansWithRsm: 0,
          totalLeaders: 0,
          totalMembers: 0,
          recordsWithoutRsm: totalCount || 0,  // ใช้ totalCount แทน 0
          recordsWithoutStatus: totalCount || 0  // ใช้ totalCount แทน 0
        }
      });
    }

    // จัดกลุ่มข้อมูลตาม RSM และ workgroup_status using UNIQUE national_id counting
    const groupedData: Record<string, { หัวหน้า: Set<string>; ลูกน้อง: Set<string> }> = {};
    
    // ตัวแปรสำหรับนับข้อมูลทั้งหมด using unique national_id
    const allNationalIds = new Set<string>();
    const nationalIdsWithRsm = new Set<string>();
    const nationalIdsWithoutRsm = new Set<string>();
    const nationalIdsWithStatus = new Set<string>();
    const nationalIdsWithoutStatus = new Set<string>();
    
    allData.forEach((row: any) => {
      const rsm = String(row.rsm || "").trim();
      const status = String(row.workgroup_status || "").toLowerCase().trim();
      const nationalId = String(row.national_id || "").trim();
      
      // Skip records without national_id
      if (!nationalId || nationalId === "null" || nationalId === "undefined") return;
      
      allNationalIds.add(nationalId);
      
      // นับข้อมูลที่มี/ไม่มี RSM (unique)
      if (rsm && rsm !== "null" && rsm !== "undefined") {
        nationalIdsWithRsm.add(nationalId);
      } else {
        nationalIdsWithoutRsm.add(nationalId);
      }
      
      // นับข้อมูลที่มี/ไม่มี workgroup_status (unique)
      if (status && status !== "null" && status !== "undefined") {
        nationalIdsWithStatus.add(nationalId);
      } else {
        nationalIdsWithoutStatus.add(nationalId);
      }
      
      if (!rsm || rsm === "null" || rsm === "undefined") return; // ข้ามข้อมูลที่ไม่มี RSM สำหรับการจัดกลุ่ม
      
      if (!groupedData[rsm]) {
        groupedData[rsm] = { หัวหน้า: new Set<string>(), ลูกน้อง: new Set<string>() };
      }
      
      // แปลง workgroup_status เป็น หัวหน้า/ลูกน้อง
      // ตรวจสอบค่าต่างๆ ที่อาจหมายถึงหัวหน้า (รวมจัดการ encoding ผิด)
      const cleanStatus = status ? status.replace(/[^\u0E00-\u0E7Fa-zA-Z]/g, '') : '';
      
      if (status && (
          status.includes("หัวหน้า") || 
          status.includes("leader") || 
          status === "l" || 
          status === "หน." ||
          status.includes("head") ||
          cleanStatus.includes("หัวหน้า") || // จัดการ encoding ผิด
          status === "หัวหน้า"
      )) {
        groupedData[rsm].หัวหน้า.add(nationalId);
      } else if (status && (
          status.includes("ลูกน้อง") ||
          status === "ลูกน้อง" ||
          cleanStatus.includes("ลูกน้อง")
      )) {
        // ถ้าเป็นลูกน้องอย่างชัดเจน
        groupedData[rsm].ลูกน้อง.add(nationalId);
      } else if (status) {
        // ถ้ามี status อื่นๆ ที่ไม่ใช่หัวหน้า = ลูกน้อง
        groupedData[rsm].ลูกน้อง.add(nationalId);
      }
    });

    // แปลงเป็น array format สำหรับ Recharts
    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        rsm,
        หัวหน้า: counts.หัวหน้า.size,
        ลูกน้อง: counts.ลูกน้อง.size,
        total: counts.หัวหน้า.size + counts.ลูกน้อง.size
      }))
      .sort((a, b) => b.total - a.total) // เรียงตาม total มากไปน้อย
      .slice(0, 20); // แสดงแค่ top 20 RSM
    
    // คำนวณ summary จากข้อมูลทั้งหมด using unique counts
    const allTotals = Object.values(groupedData);
    const totalLeaders = allTotals.reduce((sum, item) => sum + item.หัวหน้า.size, 0);
    const totalMembers = allTotals.reduce((sum, item) => sum + item.ลูกน้อง.size, 0);
    const totalTechniciansWithRsm = totalLeaders + totalMembers;
    
    console.log(`📊 Chart Summary: Total Records: ${allNationalIds.size}, Records with RSM: ${nationalIdsWithRsm.size}, Records without RSM: ${nationalIdsWithoutRsm.size}`);
    console.log(`📊 Chart Summary: Records with Status: ${nationalIdsWithStatus.size}, Records without Status: ${nationalIdsWithoutStatus.size}`);
    console.log(`📊 Chart Summary: Total RSM: ${Object.keys(groupedData).length}, Total Technicians with RSM: ${totalTechniciansWithRsm}, Leaders: ${totalLeaders}, Members: ${totalMembers}`);

    return NextResponse.json(
      { 
        chartData,
        summary: {
          totalRsm: Object.keys(groupedData).length,           // จำนวน RSM ทั้งหมด
          totalTechnicians: allNationalIds.size,               // ใช้ unique national_id count เพื่อให้ตรงกับการ์ด Technicians
          totalTechniciansWithRsm: totalTechniciansWithRsm,    // จำนวนช่างที่มี RSM
          totalLeaders: totalLeaders,                          // จำนวนหัวหน้าทั้งหมด
          totalMembers: totalMembers,                          // จำนวนลูกน้องทั้งหมด
          recordsWithoutRsm: nationalIdsWithoutRsm.size,       // จำนวนช่างที่ไม่มี RSM (unique)
          recordsWithoutStatus: nationalIdsWithoutStatus.size  // จำนวนช่างที่ไม่มี workgroup_status (unique)
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
