// Debug script to check True Tech provider data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTrueTechProvider() {
  console.log('🔍 Checking True Tech provider data...\n');
  
  // 1. Count exact match for "True Tech"
  const { count: exactCount, error: exactError } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'True Tech');
    
  console.log('1️⃣ Exact match "True Tech":', exactCount, exactError ? `(Error: ${exactError.message})` : '');
  
  // 2. Get all distinct provider values
  const { data: allProviders, error: providerError } = await supabase
    .from('technicians')
    .select('provider')
    .limit(10000);
    
  if (providerError) {
    console.error('Error fetching providers:', providerError);
    return;
  }
  
  const providerSet = new Set(allProviders.map(r => r.provider));
  const providerList = Array.from(providerSet).sort();
  
  console.log('\n2️⃣ All distinct provider values:');
  providerList.forEach(p => {
    console.log(`   - "${p}"`);
  });
  
  // 3. Check variants of True Tech
  const variants = ['True Tech', 'true tech', 'TrueTech', 'True  Tech', ' True Tech', 'True Tech '];
  console.log('\n3️⃣ Checking True Tech variants:');
  
  for (const variant of variants) {
    const { count } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', variant);
    
    if (count > 0) {
      console.log(`   "${variant}": ${count} records`);
    }
  }
  
  // 4. Sample True Tech records
  const { data: sampleRecords } = await supabase
    .from('technicians')
    .select('tech_id, national_id, provider, rsm')
    .eq('provider', 'True Tech')
    .limit(10);
    
  console.log('\n4️⃣ Sample True Tech records:');
  sampleRecords?.forEach(r => {
    console.log(`   Tech ID: ${r.tech_id}, National ID: ${r.national_id}, Provider: "${r.provider}", RSM: ${r.rsm}`);
  });
  
  // 5. Count True Tech with RSM
  const { count: withRsmCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'True Tech')
    .not('rsm', 'is', null);
    
  console.log('\n5️⃣ True Tech with RSM:', withRsmCount);
  
  // 6. Count True Tech without RSM
  const { count: withoutRsmCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'True Tech')
    .is('rsm', null);
    
  console.log('6️⃣ True Tech without RSM:', withoutRsmCount);
  
  console.log('\n✅ Debug complete');
}

checkTrueTechProvider();
