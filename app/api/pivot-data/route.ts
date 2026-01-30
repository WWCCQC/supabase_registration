// app/api/pivot-data/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function sanitize(s?: string | null) {
  if (!s || typeof s !== 'string') return '';
  return s.trim();
}

function applyFilters(query: any, params: URLSearchParams) {
  const get = (k: string) => sanitize(params.get(k));

  const filters: Record<string, string> = {
    provider: get('provider'),
    work_type: get('work_type'),
    RBM: get('rsm'),
  };

  for (const [k, v] of Object.entries(filters)) {
    if (v) query = (query as any).ilike(k, `%${v}%`);
  }

  // Handle 'q' parameter - search in multiple fields
  const q = sanitize(params.get('q'));
  if (q) {
    // Map common card names to database values
    if (q === 'Installation') {
      query = (query as any).ilike('work_type', '%Installation%');
    } else if (q === 'Repair') {
      query = (query as any).ilike('work_type', '%Repair%');
    } else if (q === 'WW-Provider' || q === 'True Tech' || q === 'เถ้าแก่เทค') {
      query = (query as any).ilike('provider', `%${q}%`);
    }
  }

  return query;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('📊 Starting pivot data fetch with filters:', Object.fromEntries(searchParams));
    
    const supabase = supabaseAdmin();
    
    // ดึงข้อมูลทั้งหมดแบบ pagination เพื่อให้ได้ข้อมูลครบ
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from('technicians')
        .select('RBM, provider, work_type, national_id')
        .not('RBM', 'is', null)
        .not('provider', 'is', null)
        .not('work_type', 'is', null)
        .neq('RBM', '')
        .neq('provider', '')
        .neq('work_type', '');

      // Apply filters
      query = applyFilters(query, searchParams);

      const { data, error } = await query.range(from, from + batchSize - 1);

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
      const key = `${row.RBM}|${row.provider}|${row.work_type}`;
      pivotMap.set(key, (pivotMap.get(key) || 0) + 1);
    });

    // แปลงเป็น array format สำหรับ component
    const pivotData = Array.from(pivotMap.entries()).map(([key, count]) => {
      const [RBM, provider, work_type] = key.split('|');
      return {
        RBM,
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