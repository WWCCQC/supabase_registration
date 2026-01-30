export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable caching completely
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("force") === "true";
    
    const supabase = supabaseAdmin();
    
    // Force refresh: ใช้ random comment เพื่อ bypass query cache
    if (forceRefresh) {
      console.log('🔄 RSM Workgroup Chart - Force refresh requested');
    }
    
    // Fetch all data with proper pagination including national_id for unique counting
    // ไม่ใช้ count query เพราะมีปัญหา encoding ให้ผลลัพธ์ไม่ถูกต้อง
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from("technicians")
        .select("RBM, provider, power_authority, national_id")
        .order("tech_id", { ascending: true })
        .range(from, from + pageSize - 1);
      
      // Force refresh: เพิ่มเงื่อนไขที่ไม่กระทบข้อมูลเพื่อ invalidate cache
      if (forceRefresh) {
        query = query.gte('tech_id', 0);
      }
      
      const { data, error } = await query;
      
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

    console.log(`📊 Chart API: Fetched ${allData?.length || 0} records from database`);

    if (!allData || allData.length === 0) {
      return NextResponse.json({ 
        chartData: [], 
        summary: {
          totalRsm: 0,
          totalTechnicians: 0,
          totalTechniciansWithRsm: 0,
          totalYes: 0,
          totalNo: 0,
          recordsWithoutRsm: 0,
          recordsWithoutAuthority: 0
        }
      });
    }

    // จัดกลุ่มข้อมูลตาม RSM และ power_authority using UNIQUE national_id counting
    const groupedData: Record<string, { Yes: Set<string>; No: Set<string> }> = {};
    
    // ตัวแปรสำหรับนับข้อมูลทั้งหมด using unique national_id
    const allNationalIds = new Set<string>();
    const nationalIdsWithRsm = new Set<string>();
    const nationalIdsWithoutRsm = new Set<string>();
    const nationalIdsWithAuthority = new Set<string>();
    const nationalIdsWithoutAuthority = new Set<string>();
    
    // เพิ่มตัวแปรสำหรับนับ Yes/No ทั้งหมด (ไม่จำกัดแค่มี RSM)
    const allYesNationalIds = new Set<string>();
    const allNoNationalIds = new Set<string>();
    
    allData.forEach((row: any) => {
      const rsm = String(row.RBM || "").trim();
      const powerAuthority = String(row.power_authority || "").trim();
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
      
      // นับข้อมูลที่มี/ไม่มี power_authority (unique)
      if (powerAuthority && powerAuthority !== "null" && powerAuthority !== "undefined") {
        nationalIdsWithAuthority.add(nationalId);
        
        // นับ Yes/No จากข้อมูลทั้งหมด (ไม่ว่าจะมี RSM หรือไม่)
        const cleanAuthority = powerAuthority.toLowerCase();
        if (cleanAuthority === "yes" || cleanAuthority === "y") {
          allYesNationalIds.add(nationalId);
        } else if (cleanAuthority === "no" || cleanAuthority === "n") {
          allNoNationalIds.add(nationalId);
        }
      } else {
        nationalIdsWithoutAuthority.add(nationalId);
      }
      
      if (!rsm || rsm === "null" || rsm === "undefined") return; // ข้ามข้อมูลที่ไม่มี RSM สำหรับการจัดกลุ่ม
      
      // ข้ามถ้าไม่มี power_authority (เข้มงวด: ต้องมีค่า Yes หรือ No เท่านั้น)
      if (!powerAuthority || powerAuthority === "null" || powerAuthority === "undefined") return;
      
      if (!groupedData[rsm]) {
        groupedData[rsm] = { Yes: new Set<string>(), No: new Set<string>() };
      }
      
      // แปลง power_authority เป็น Yes/No (เข้มงวด: ต้องตรงกับ Yes/No เท่านั้น)
      const cleanAuthority = powerAuthority.toLowerCase();
      
      if (cleanAuthority === "yes" || cleanAuthority === "y") {
        groupedData[rsm].Yes.add(nationalId);
      } else if (cleanAuthority === "no" || cleanAuthority === "n") {
        groupedData[rsm].No.add(nationalId);
      }
      // หมายเหตุ: ถ้า power_authority ไม่ใช่ Yes/No จะไม่ถูกนับ (เข้มงวด)
    });

    // แปลงเป็น array format สำหรับ Recharts
    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        RBM: rsm,
        Yes: counts.Yes.size,
        No: counts.No.size,
        total: counts.Yes.size + counts.No.size
      }))
      .sort((a, b) => b.total - a.total) // เรียงตาม total มากไปน้อย
      .slice(0, 20); // แสดงแค่ top 20 RBM
    
    // คำนวณ summary - ใช้ค่าจาก fetched data เพราะ count query ของ Supabase ไม่ถูกต้อง (encoding issue)
    // NOTE: count query ได้ Yes=400 แต่ fetch + count จริง ๆ ได้ Yes=390 (ตรวจสอบแล้วว่า 390 ถูกต้อง)
    const totalYes = allYesNationalIds.size;  // ใช้ค่า fetched ที่ถูกต้อง
    const totalNo = allNoNationalIds.size;     // ใช้ค่า fetched ที่ถูกต้อง
    const totalTechniciansWithRsm = nationalIdsWithRsm.size;
    
    console.log(`📊 RSM Workgroup API v2.0 - Using fetched data only (no count query)`);
    console.log(`📊 Chart Summary: Total Records: ${allNationalIds.size}, Records with RSM: ${nationalIdsWithRsm.size}, Records without RSM: ${nationalIdsWithoutRsm.size}`);
    console.log(`📊 Chart Summary: Records with Authority: ${nationalIdsWithAuthority.size}, Records without Authority: ${nationalIdsWithoutAuthority.size}`);
    console.log(`📊 Chart Summary: Total RSM: ${Object.keys(groupedData).length}, Total Technicians with RSM: ${totalTechniciansWithRsm}`);
    console.log(`📊 Chart Summary: Total Yes (from fetched data): ${allYesNationalIds.size}, Total No: ${allNoNationalIds.size}, Sum: ${allYesNationalIds.size + allNoNationalIds.size}`);

    return NextResponse.json(
      { 
        chartData,
        forceRefresh: forceRefresh,
        timestamp: new Date().toISOString(),
        version: "2.0.0", // v2.0: ใช้ fetched data เท่านั้น ไม่ใช้ count query
        summary: {
          totalRBM: Object.keys(groupedData).length,           // จำนวน RBM ทั้งหมด
          totalTechnicians: allNationalIds.size,               // นับจาก fetched data จริง ๆ
          totalTechniciansWithRBM: totalTechniciansWithRsm,    // จำนวนช่างที่มี RBM
          totalYes: totalYes,                                  // จำนวนช่างที่มี power_authority = Yes (นับจาก fetched)
          totalNo: totalNo,                                    // จำนวนช่างที่มี power_authority = No (นับจาก fetched)
          recordsWithoutRBM: nationalIdsWithoutRsm.size,       // จำนวนช่างที่ไม่มี RBM (unique)
          recordsWithoutAuthority: nationalIdsWithoutAuthority.size  // จำนวนช่างที่ไม่มี power_authority (unique)
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
