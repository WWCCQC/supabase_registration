export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First get total count
    const { count } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true });

    const totalRecords = count || 0;
    console.log('📊 Total transaction records:', totalRecords);

    // Fetch in batches if needed (Supabase has a limit)
    let allTransactions: any[] = [];
    const batchSize = 1000;
    let currentBatch = 0;

    while (currentBatch * batchSize < totalRecords) {
      const from = currentBatch * batchSize;
      const to = Math.min(from + batchSize - 1, totalRecords - 1);

      const { data, error } = await supabase
        .from('transaction')
        .select('Year, Month, Week, Date')
        .range(from, to);

      if (error) {
        console.error('Supabase error at batch', currentBatch, ':', error);
        break;
      }

      if (data) {
        allTransactions = [...allTransactions, ...data];
      }

      currentBatch++;
      
      // Safety limit to prevent infinite loop
      if (currentBatch > 100) break;
    }

    console.log('📥 Fetched transactions:', allTransactions.length, '/', totalRecords);

    // Month order for sorting
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Extract unique values and sort
    const years = [...new Set(allTransactions?.map((item: any) => item.Year).filter(Boolean))].sort();
    
    // Sort months by calendar order, not alphabetically
    const uniqueMonths = [...new Set(allTransactions?.map((item: any) => item.Month).filter(Boolean))];
    const months = uniqueMonths.sort((a: any, b: any) => {
      return monthOrder.indexOf(a) - monthOrder.indexOf(b);
    });
    
    // Convert weeks to strings for consistent comparison
    const weeks = [...new Set(allTransactions?.map((item: any) => String(item.Week)).filter(Boolean))].sort((a: any, b: any) => Number(a) - Number(b));
    const dates = [...new Set(allTransactions?.map((item: any) => item.Date).filter(Boolean))].sort();
    
    console.log('🔍 Unique values found:', {
      years: years.length,
      months: months.length,
      weeks: weeks.length,
      dates: dates.length
    });
    console.log('📅 Months:', months);

    console.log('📊 Filter options loaded:', { 
      years: years.length, 
      months: months.length, 
      weeks: weeks.length, 
      dates: dates.length 
    });

    return NextResponse.json({
      years,
      months,
      weeks,
      dates
    });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}