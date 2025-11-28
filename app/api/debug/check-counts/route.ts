export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    
    const results: any = {
      direct_counts: {},
      with_national_id: {},
      differences: {}
    };
    
    const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
    
    // Count direct (all records)
    for (const provider of providers) {
      const { count, error } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .eq('provider', provider);
      
      if (error) {
        console.error(`Error counting ${provider}:`, error);
      }
      
      results.direct_counts[provider] = count || 0;
    }
    
    // Count with national_id NOT NULL
    for (const provider of providers) {
      const { count, error } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .eq('provider', provider)
        .not('national_id', 'is', null);
      
      if (error) {
        console.error(`Error counting ${provider} with national_id:`, error);
      }
      
      results.with_national_id[provider] = count || 0;
      results.differences[provider] = (results.direct_counts[provider] || 0) - (count || 0);
    }
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('Check counts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
