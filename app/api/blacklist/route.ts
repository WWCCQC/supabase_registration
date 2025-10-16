import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Blacklist API - Fetching data:', { page, limit });

    // Get total count
    const { count, error: countError } = await supabase
      .from('Blacklist')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count error:', countError);
      return NextResponse.json(
        { error: countError.message, details: countError },
        { status: 400 }
      );
    }

    console.log('📊 Total count:', count);

    // Get paginated data
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error: fetchError } = await supabase
      .from('Blacklist')
      .select('*')
      .order('Date', { ascending: false })
      .range(from, to);

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json(
        { error: fetchError.message, details: fetchError },
        { status: 400 }
      );
    }

    console.log('✅ Data fetched:', { 
      count, 
      dataLength: data?.length,
      from,
      to,
      firstRecord: data?.[0]
    });

    return NextResponse.json({
      data: data || [],
      totalCount: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });

  } catch (error: any) {
    console.error('❌ Blacklist API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
