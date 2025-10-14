// app/api/pivot-data/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  try {
    console.log('📊 Starting pivot data fetch...');
    
    const supabase = supabaseAdmin();
    
    // ดึงข้อมูลทั้งหมดแบบ pagination เพื่อให้ได้ข้อมูลครบ
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type, national_id')
        .not('rsm', 'is', null)
        .not('provider', 'is', null)
        .not('work_type', 'is', null)
        .neq('rsm', '')
        .neq('provider', '')
        .neq('work_type', '')
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('❌ Error in pivot data batch fetch:', error);
        throw error;
      }

      console.log(`📊 Pivot data - Batch ${Math.floor(from/batchSize) + 1}: Found ${data?.length || 0} rows`);

      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === batchSize;
        from += batchSize;
        console.log(`📊 Pivot data - Total rows so far: ${allData.length}`);
      } else {
        hasMore = false;
        console.log(`📊 Pivot data - No more data, stopping pagination`);
      }
      
      // ป้องกัน infinite loop
      if (from > 100000) {
        console.warn('🚨 Reached maximum rows limit (100k), stopping');
        break;
      }
    }

    console.log(`📊 Total data fetched: ${allData.length} rows`);

    // จัดกลุ่มข้อมูลและนับ
    const pivotMap = new Map<string, number>();
    
    allData.forEach(row => {
      const key = `${row.rsm}|${row.provider}|${row.work_type}`;
      pivotMap.set(key, (pivotMap.get(key) || 0) + 1);
    });

    // แปลงเป็น array format สำหรับ component
    const pivotData = Array.from(pivotMap.entries()).map(([key, count]) => {
      const [rsm, provider, work_type] = key.split('|');
      return {
        rsm,
        provider,
        work_type,
        count
      };
    });

    console.log(`📊 Pivot data processed: ${pivotData.length} unique combinations`);
    console.log(`📊 Sample data:`, pivotData.slice(0, 5));

    return NextResponse.json({
      data: pivotData,
      total_rows: allData.length,
      unique_combinations: pivotData.length
    });

  } catch (error: any) {
    console.error('❌ Error in pivot-data API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}