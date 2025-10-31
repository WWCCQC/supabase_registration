export const dynamic = "force-dynamic";
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
    
    // Get total count first
    let countQuery = supabase.from("technicians").select("*", { count: "exact", head: true });
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error("RSM Workgroup Chart count error:", countError);
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    
    // Get power_authority counts from DB with pagination (for accurate Yes/No counts)
    // Fetch all records with Yes/Y power_authority
    let yesData: any[] = [];
    let yesFrom = 0;
    let yesHasMore = true;
    
    while (yesHasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("national_id")
        .or('power_authority.ilike.Yes,power_authority.ilike.Y')
        .range(yesFrom, yesFrom + 999);
      
      if (error) {
        console.error("RSM Workgroup Chart Yes count error:", error);
        break;
      }
      
      if (data && data.length > 0) {
        yesData = [...yesData, ...data];
        yesFrom += 1000;
        yesHasMore = data.length === 1000;
      } else {
        yesHasMore = false;
      }
    }
    
    // Fetch all records with No/N power_authority
    let noData: any[] = [];
    let noFrom = 0;
    let noHasMore = true;
    
    while (noHasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("national_id")
        .or('power_authority.ilike.No,power_authority.ilike.N')
        .range(noFrom, noFrom + 999);
      
      if (error) {
        console.error("RSM Workgroup Chart No count error:", error);
        break;
      }
      
      if (data && data.length > 0) {
        noData = [...noData, ...data];
        noFrom += 1000;
        noHasMore = data.length === 1000;
      } else {
        noHasMore = false;
      }
    }
    
    // Count unique national_ids for Yes and No
    const dbYesCount = yesData ? new Set(yesData.map(r => String(r.national_id).trim())).size : 0;
    const dbNoCount = noData ? new Set(noData.map(r => String(r.national_id).trim())).size : 0;
    
    console.log(`📊 Power Authority counts from DB: Yes=${dbYesCount} (fetched ${yesData.length}), No=${dbNoCount} (fetched ${noData.length}), Total=${dbYesCount + dbNoCount}`);
    
    // Fetch all data with proper pagination including national_id for unique counting
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from("technicians")
        .select("rsm, provider, power_authority, national_id")
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

    console.log(`📊 Chart API: Fetched ${allData?.length || 0} records from database (DB count: ${totalCount || 0}) - Fixed encoding issue`);
    console.log(`📊 Chart API: Using actual fetched count (${allData?.length || 0}) for consistency with Table Editor`);
    
    // ⚠️ Warning if fetched count doesn't match DB count
    if (totalCount && allData.length !== totalCount) {
      console.warn(`⚠️  Warning: Fetched ${allData.length} records but DB count is ${totalCount} (missing ${totalCount - allData.length} records)`);
      console.warn(`   This may indicate encoding issues or data corruption in some records`);
    }

    if (!allData || allData.length === 0) {
      return NextResponse.json({ 
        chartData: [], 
        summary: {
          totalRsm: 0,
          totalTechnicians: totalCount || 0,  // ใช้ totalCount แทน 0
          totalTechniciansWithRsm: 0,
          totalYes: 0,
          totalNo: 0,
          recordsWithoutRsm: totalCount || 0,  // ใช้ totalCount แทน 0
          recordsWithoutAuthority: totalCount || 0  // ใช้ totalCount แทน 0
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
      const rsm = String(row.rsm || "").trim();
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
        rsm,
        Yes: counts.Yes.size,
        No: counts.No.size,
        total: counts.Yes.size + counts.No.size
      }))
      .sort((a, b) => b.total - a.total) // เรียงตาม total มากไปน้อย
      .slice(0, 20); // แสดงแค่ top 20 RSM
    
    // คำนวณ summary - ใช้ค่าจาก DB แทนค่าที่นับจาก fetched data
    const totalYes = dbYesCount || allYesNationalIds.size;  // ใช้ค่าจาก DB แทน
    const totalNo = dbNoCount || allNoNationalIds.size;     // ใช้ค่าจาก DB แทน
    const totalTechniciansWithRsm = nationalIdsWithRsm.size;
    
    console.log(`📊 Chart Summary: Total Records: ${allNationalIds.size}, Records with RSM: ${nationalIdsWithRsm.size}, Records without RSM: ${nationalIdsWithoutRsm.size}`);
    console.log(`📊 Chart Summary: Records with Authority: ${nationalIdsWithAuthority.size}, Records without Authority: ${nationalIdsWithoutAuthority.size}`);
    console.log(`📊 Chart Summary: Total RSM: ${Object.keys(groupedData).length}, Total Technicians with RSM: ${totalTechniciansWithRsm}`);
    console.log(`📊 Chart Summary: Total Yes (DB): ${dbYesCount}, Total No (DB): ${dbNoCount}, Sum: ${dbYesCount + dbNoCount}`);
    console.log(`📊 Chart Summary: Total Yes (fetched): ${allYesNationalIds.size}, Total No (fetched): ${allNoNationalIds.size}, Sum: ${allYesNationalIds.size + allNoNationalIds.size}`);
    
    // ⚠️ Warning if DB counts don't match fetched counts
    if (dbYesCount !== allYesNationalIds.size || dbNoCount !== allNoNationalIds.size) {
      console.warn(`⚠️  Warning: Power Authority counts mismatch!`);
      console.warn(`   DB: Yes=${dbYesCount}, No=${dbNoCount}`);
      console.warn(`   Fetched: Yes=${allYesNationalIds.size}, No=${allNoNationalIds.size}`);
      console.warn(`   Using DB counts for accuracy`);
    }

    return NextResponse.json(
      { 
        chartData,
        forceRefresh: forceRefresh,
        timestamp: new Date().toISOString(),
        summary: {
          totalRsm: Object.keys(groupedData).length,           // จำนวน RSM ทั้งหมด
          totalTechnicians: totalCount || allNationalIds.size, // ใช้ค่าจริงจาก DB แทนการนับจาก fetched data
          totalTechniciansWithRsm: totalTechniciansWithRsm,    // จำนวนช่างที่มี RSM
          totalYes: totalYes,                                  // จำนวนช่างที่มี power_authority = Yes
          totalNo: totalNo,                                    // จำนวนช่างที่มี power_authority = No
          recordsWithoutRsm: nationalIdsWithoutRsm.size,       // จำนวนช่างที่ไม่มี RSM (unique)
          recordsWithoutAuthority: nationalIdsWithoutAuthority.size,  // จำนวนช่างที่ไม่มี power_authority (unique)
          _debug: {                                           // เพิ่ม debug info
            dbCount: totalCount,
            fetchedCount: allData.length,
            uniqueNationalIds: allNationalIds.size,
            discrepancy: totalCount ? totalCount - allData.length : 0,
            powerAuthority: {
              dbYes: dbYesCount,
              dbNo: dbNoCount,
              fetchedYes: allYesNationalIds.size,
              fetchedNo: allNoNationalIds.size,
              yesDiff: dbYesCount - allYesNationalIds.size,
              noDiff: dbNoCount - allNoNationalIds.size
            }
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
    console.error("Chart API error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
