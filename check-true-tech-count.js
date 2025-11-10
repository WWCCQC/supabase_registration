const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTrueTechCount() {
  console.log('🔍 Checking True Tech count in Supabase...\n');
  
  try {
    // Method 1: Count with .eq() (same as API)
    const { count: exactCount, error: exactError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'True Tech');
    
    if (exactError) {
      console.error('Error counting True Tech:', exactError);
      return;
    }
    
    console.log(`✅ Exact count with .eq("provider", "True Tech"): ${exactCount}`);
    
    // Method 2: Fetch all and count manually
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('national_id, tech_id, full_name, provider, rsm')
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error('Error fetching data:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    const trueTechRecords = allData.filter(t => t.provider === 'True Tech');
    console.log(`\n✅ Manual count (fetch all & filter): ${trueTechRecords.length}`);
    
    // Check for variations
    const allProviders = [...new Set(allData.map(t => t.provider))];
    const trueTechVariants = allProviders.filter(p => 
      p && p.toLowerCase().includes('true') && p.toLowerCase().includes('tech')
    );
    
    console.log('\n📋 All True Tech variants found:');
    trueTechVariants.forEach(variant => {
      const count = allData.filter(t => t.provider === variant).length;
      console.log(`  "${variant}": ${count}`);
    });
    
    // Sample True Tech records
    console.log('\n📝 Sample True Tech records (first 5):');
    trueTechRecords.slice(0, 5).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.full_name} | Provider: "${t.provider}" | RSM: ${t.rsm || '(none)'}`);
    });
    
    // Count True Tech with/without RSM
    const trueTechWithRSM = trueTechRecords.filter(t => t.rsm && t.rsm.trim() !== '');
    const trueTechWithoutRSM = trueTechRecords.filter(t => !t.rsm || t.rsm.trim() === '');
    
    console.log(`\n📊 True Tech breakdown:`);
    console.log(`  With RSM: ${trueTechWithRSM.length}`);
    console.log(`  Without RSM: ${trueTechWithoutRSM.length}`);
    console.log(`  Total: ${trueTechRecords.length}`);
    
    // Compare with other providers
    console.log('\n📊 All providers count:');
    const wwProvider = allData.filter(t => t.provider === 'WW-Provider').length;
    const taokaeTech = allData.filter(t => t.provider === 'เถ้าแก่เทค').length;
    console.log(`  WW-Provider: ${wwProvider}`);
    console.log(`  True Tech: ${trueTechRecords.length}`);
    console.log(`  เถ้าแก่เทค: ${taokaeTech}`);
    console.log(`  Total (3 main providers): ${wwProvider + trueTechRecords.length + taokaeTech}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTrueTechCount();
