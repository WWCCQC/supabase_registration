const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPowerAuthorityValues() {
  console.log('🔍 Checking all power_authority values...\n');
  
  let all = [];
  let page = 0;
  
  while (true) {
    const { data } = await supabase
      .from('technicians')
      .select('power_authority')
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  
  const counts = {};
  all.forEach(r => {
    const val = String(r.power_authority || '').trim();
    counts[val] = (counts[val] || 0) + 1;
  });
  
  console.log('📊 All power_authority values:');
  console.log('═══════════════════════════════════════');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => {
      console.log(`  '${k}': ${v}`);
    });
  console.log('═══════════════════════════════════════');
  console.log(`Total records: ${all.length}`);
  console.log('');
  
  // Test count query
  const { count: yesCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .eq('power_authority', 'Yes');
    
  const { count: noCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .eq('power_authority', 'No');
    
  console.log('✅ Direct count query results:');
  console.log(`Yes: ${yesCount}`);
  console.log(`No: ${noCount}`);
  console.log(`Sum: ${yesCount + noCount}`);
}

checkPowerAuthorityValues();
