// app/api/depot-codes-by-provider/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const listAll = searchParams.get('list_all');
    
    const supabase = supabaseAdmin();
    
    // ถ้าขอรายการ provider ทั้งหมด
    if (listAll === 'true') {
      const { data, error } = await supabase
        .from('technicians')
        .select('provider')
        .not('provider', 'is', null)
        .neq('provider', '');
        
      if (error) throw error;
      
      const uniqueProviders = Array.from(new Set(data.map(row => row.provider)));
      console.log('📋 All unique providers:', uniqueProviders);
      return NextResponse.json(uniqueProviders);
    }
    
    if (!provider) {
      return NextResponse.json({ error: 'Provider parameter is required' }, { status: 400 });
    }

    // ดึงข้อมูล depot_code ที่ไม่ซ้ำสำหรับ provider นี้ แบบ pagination
    
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    console.log(`🔍 API: Starting search for provider: "${provider}"`);
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('depot_code, provider')
        .eq('provider', provider)
        .not('depot_code', 'is', null)
        .neq('depot_code', '')
        .range(from, from + batchSize - 1);

      if (error) {
        console.error(`❌ Error in batch fetch for ${provider}:`, error);
        throw error;
      }

      console.log(`📊 Provider ${provider} - Batch ${Math.floor(from/batchSize) + 1}: Found ${data?.length || 0} rows`);

      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === batchSize;
        from += batchSize;
        console.log(`📊 Provider ${provider} - Total rows so far: ${allData.length}`);
        
        // แสดงตัวอย่างข้อมูลใน batch แรก
        if (from === batchSize) {
          console.log(`📊 Sample data for ${provider}:`, data.slice(0, 3));
        }
      } else {
        hasMore = false;
        console.log(`📊 Provider ${provider} - No more data, stopping pagination`);
      }
      
      // ป้องกัน infinite loop
      if (from > 100000) {
        console.warn('🚨 Reached maximum rows limit (100k), stopping');
        break;
      }
    }

    // นับ depot_code ที่ไม่ซ้ำสำหรับ provider นี้
    const uniqueDepotCodes = new Set();
    allData.forEach((row: any) => {
      if (row.depot_code && row.depot_code.trim()) {
        uniqueDepotCodes.add(row.depot_code.trim());
      }
    });

    const count = uniqueDepotCodes.size;
    console.log(`📊 Provider ${provider}: Found ${count} unique depot codes from ${allData.length} total rows`);

    return NextResponse.json({
      provider,
      count,
      total_rows: allData.length
    });

  } catch (error: any) {
    console.error('❌ Error in depot-codes-by-provider API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}