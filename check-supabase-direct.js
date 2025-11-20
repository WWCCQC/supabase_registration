// ตรวจสอบข้อมูลจริงจาก Supabase โดยตรง
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ohneqyobbbndgjwykuoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obmVxeW9iYmJuZGdqd3lrdW9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzI1ODM4NiwiZXhwIjoyMDQyODM0Mzg2fQ.qVz-HFFEQkwoG7f-BCCt-7nhwdmB8l-yNW3CYlFzZvE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDirectCounts() {
  console.log('🔍 Checking direct counts from Supabase...\n');
  
  try {
    // 1. Count WW-Provider
    const { count: wwCount, error: wwError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'WW-Provider');
    
    if (wwError) {
      console.error('Error counting WW-Provider:', wwError);
    } else {
      console.log(`WW-Provider (direct count): ${wwCount}`);
    }
    
    // 2. Count True Tech
    const { count: ttCount, error: ttError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'True Tech');
    
    if (ttError) {
      console.error('Error counting True Tech:', ttError);
    } else {
      console.log(`True Tech (direct count): ${ttCount}`);
    }
    
    // 3. Count เถ้าแก่เทค
    const { count: taCount, error: taError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'เถ้าแก่เทค');
    
    if (taError) {
      console.error('Error counting เถ้าแก่เทค:', taError);
    } else {
      console.log(`เถ้าแก่เทค (direct count): ${taCount}`);
    }
    
    console.log(`\n📊 Total: ${(wwCount || 0) + (ttCount || 0) + (taCount || 0)}`);
    
    // 4. Count with national_id NOT NULL
    console.log('\n📊 Counts with national_id NOT NULL:');
    
    const { count: wwNatCount, error: wwNatError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'WW-Provider')
      .not('national_id', 'is', null);
    
    if (!wwNatError) {
      console.log(`WW-Provider (with national_id): ${wwNatCount}`);
    }
    
    const { count: ttNatCount, error: ttNatError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'True Tech')
      .not('national_id', 'is', null);
    
    if (!ttNatError) {
      console.log(`True Tech (with national_id): ${ttNatCount}`);
    }
    
    const { count: taNatCount, error: taNatError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'เถ้าแก่เทค')
      .not('national_id', 'is', null);
    
    if (!taNatError) {
      console.log(`เถ้าแก่เทค (with national_id): ${taNatCount}`);
    }
    
    console.log(`\n📊 Total (with national_id): ${(wwNatCount || 0) + (ttNatCount || 0) + (taNatCount || 0)}`);
    
    console.log('\n❌ Difference (without national_id):');
    console.log(`WW-Provider: ${(wwCount || 0) - (wwNatCount || 0)}`);
    console.log(`True Tech: ${(ttCount || 0) - (ttNatCount || 0)}`);
    console.log(`เถ้าแก่เทค: ${(taCount || 0) - (taNatCount || 0)}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDirectCounts();
