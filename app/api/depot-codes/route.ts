// app/api/depot-codes/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ดึง distinct depot_code จากฐานข้อมูลโดยตรง แบบ pagination เพื่อให้ได้ข้อมูลทั้งหมด
    const supabase = supabaseAdmin();
    
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('depot_code')
        .not('depot_code', 'is', null)
        .neq('depot_code', '')
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('❌ Error in batch fetch:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === batchSize;
        from += batchSize;
        console.log(`📊 Fetched batch: ${data.length} rows, total so far: ${allData.length}`);
      } else {
        hasMore = false;
      }
      
      // ป้องกัน infinite loop
      if (from > 100000) {
        console.warn('🚨 Reached maximum rows limit (100k), stopping');
        break;
      }
    }

    // นับ depot_code ที่ไม่ซ้ำจากข้อมูลทั้งหมด
    const uniqueDepotCodes = new Set();
    allData.forEach((row: any) => {
      if (row.depot_code && row.depot_code.trim()) {
        uniqueDepotCodes.add(row.depot_code.trim());
      }
    });

    const count = uniqueDepotCodes.size;
    console.log(`📊 Depot codes API: Found ${count} unique depot codes from ${allData.length} total rows`);
    console.log(`📊 Sample depot codes:`, Array.from(uniqueDepotCodes).slice(0, 10));

    return NextResponse.json({
      count,
      total_rows: allData.length,
      sample_codes: Array.from(uniqueDepotCodes).slice(0, 20)
    });

  } catch (error: any) {
    console.error('❌ Error in depot-codes API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}