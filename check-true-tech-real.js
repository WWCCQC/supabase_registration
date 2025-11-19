const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ohneqyobbbndgjwykuoj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obmVxeW9iYmJuZGdqd3lrdW9qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzI1ODM4NiwiZXhwIjoyMDQyODM0Mzg2fQ.qVz-HFFEQkwoG7f-BCCt-7nhwdmB8l-yNW3CYlFzZvE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrueTech() {
  console.log('🔍 Checking True Tech records...\n');
  
  // 1. Count total True Tech
  const { count: totalCount, error: countError } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'True Tech');
  
  if (countError) {
    console.error('Error counting True Tech:', countError);
    return;
  }
  
  console.log(`📊 Total True Tech in database: ${totalCount}`);
  
  // 2. Fetch all True Tech records
  let allRecords = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('technicians')
      .select('tech_id, rsm, provider, national_id')
      .eq('provider', 'True Tech')
      .order('tech_id', { ascending: true })
      .range(from, from + pageSize - 1);
    
    if (error) {
      console.error('Error fetching True Tech:', error);
      return;
    }
    
    if (data && data.length > 0) {
      allRecords = [...allRecords, ...data];
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`📊 Fetched ${allRecords.length} True Tech records\n`);
  
  // 3. Group by RSM
  const byRsm = {};
  allRecords.forEach(rec => {
    const rsm = rec.rsm || 'No RSM';
    if (!byRsm[rsm]) byRsm[rsm] = [];
    byRsm[rsm].push(rec);
  });
  
  console.log('📊 True Tech by RSM:');
  Object.entries(byRsm).forEach(([rsm, records]) => {
    console.log(`   ${rsm}: ${records.length}`);
  });
  
  const total = Object.values(byRsm).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\n✅ Total True Tech: ${total}`);
  
  // 4. Check for any filtering issues
  const withRsm = allRecords.filter(r => r.rsm);
  const withoutRsm = allRecords.filter(r => !r.rsm);
  
  console.log(`\n📊 With RSM: ${withRsm.length}`);
  console.log(`📊 Without RSM: ${withoutRsm.length}`);
}

checkTrueTech();
