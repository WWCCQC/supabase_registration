// Analyze provider data discrepancy
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDiscrepancy() {
  try {
    console.log('🔍 Analyzing WW-Provider count discrepancy\n');
    
    // Get all data with same logic as API
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('rsm, provider')
        .order('national_id', { ascending: true, nullsFirst: true })
        .range(from, from + pageSize - 1);
        
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Total Records: ${allData.length}\n`);
    
    // 1. Count all providers (no filtering)
    const allProviders = {};
    allData.forEach(row => {
      const provider = String(row.provider || "").trim();
      if (provider) {
        allProviders[provider] = (allProviders[provider] || 0) + 1;
      }
    });
    
    console.log('📈 All Providers (no RSM filter):');
    Object.entries(allProviders)
      .sort(([,a], [,b]) => b - a)
      .forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });
    
    // 2. Count providers with RSM filter (same as API logic)
    const rsmGroups = {};
    const withoutRSM = [];
    
    allData.forEach(row => {
      const rsm = String(row.rsm || "").trim();
      const provider = String(row.provider || "").trim();
      
      if (!rsm) {
        withoutRSM.push(row);
        return; // Skip records without RSM (same as API)
      }
      
      if (!rsmGroups[rsm]) {
        rsmGroups[rsm] = { "WW-Provider": 0, "True Tech": 0, "เถ้าแก่เทค": 0, "อื่นๆ": 0 };
      }
      
      const trimmedProvider = provider.trim();
      if (trimmedProvider === "WW-Provider") {
        rsmGroups[rsm]["WW-Provider"]++;
      } else if (trimmedProvider === "True Tech") {
        rsmGroups[rsm]["True Tech"]++;
      } else if (trimmedProvider === "เถ้าแก่เทค") {
        rsmGroups[rsm]["เถ้าแก่เทค"]++;
      } else if (trimmedProvider) {
        rsmGroups[rsm]["อื่นๆ"]++;
      } else {
        rsmGroups[rsm]["อื่นๆ"]++;
      }
    });
    
    // Calculate totals from RSM grouping
    const allTotals = Object.values(rsmGroups);
    const totalWWProvider = allTotals.reduce((sum, item) => sum + item["WW-Provider"], 0);
    const totalTrueTech = allTotals.reduce((sum, item) => sum + item["True Tech"], 0);
    const totalTaoKae = allTotals.reduce((sum, item) => sum + item["เถ้าแก่เทค"], 0);
    
    console.log('\n📊 Providers with RSM filter (API logic):');
    console.log(`  WW-Provider: ${totalWWProvider}`);
    console.log(`  True Tech: ${totalTrueTech}`);
    console.log(`  เถ้าแก่เทค: ${totalTaoKae}`);
    
    console.log(`\n📊 Records without RSM: ${withoutRSM.length}`);
    
    // Analyze records without RSM
    const withoutRSMProviders = {};
    withoutRSM.forEach(row => {
      const provider = String(row.provider || "").trim();
      if (provider) {
        withoutRSMProviders[provider] = (withoutRSMProviders[provider] || 0) + 1;
      }
    });
    
    if (Object.keys(withoutRSMProviders).length > 0) {
      console.log('\n🔍 Providers in records without RSM:');
      Object.entries(withoutRSMProviders)
        .sort(([,a], [,b]) => b - a)
        .forEach(([provider, count]) => {
          console.log(`  ${provider}: ${count}`);
        });
    }
    
    // Show discrepancy
    console.log('\n❌ Discrepancy Analysis:');
    console.log(`All WW-Provider: ${allProviders['WW-Provider'] || 0}`);
    console.log(`WW-Provider with RSM: ${totalWWProvider}`);
    console.log(`WW-Provider without RSM: ${withoutRSMProviders['WW-Provider'] || 0}`);
    console.log(`Missing from chart: ${(allProviders['WW-Provider'] || 0) - totalWWProvider} records`);
    
    // Show what should be the correct numbers
    console.log('\n✅ Correct numbers should be:');
    console.log(`  WW-Provider: ${allProviders['WW-Provider'] || 0} (not ${totalWWProvider})`);
    console.log(`  True Tech: ${allProviders['True Tech'] || 0} (not ${totalTrueTech})`);
    console.log(`  เถ้าแก่เทค: ${allProviders['เถ้าแก่เทค'] || 0} (matches: ${totalTaoKae})`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeDiscrepancy();
