// Compare API result with direct database query
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function compareData() {
  try {
    console.log('🔍 Comparing API vs Direct Database Query\n');
    
    // 1. Call API
    console.log('📡 Calling API...');
    const apiResponse = await fetch('http://localhost:3001/api/chart/rsm-provider');
    const apiData = await apiResponse.json();
    
    console.log('API Summary:');
    console.log(`  Total Technicians: ${apiData.summary?.totalTechnicians || 0}`);
    console.log(`  WW-Provider: ${apiData.summary?.providers?.['WW-Provider'] || 0}`);
    console.log(`  True Tech: ${apiData.summary?.providers?.['True Tech'] || 0}`);
    console.log(`  เถ้าแก่เทค: ${apiData.summary?.providers?.['เถ้าแก่เทค'] || 0}`);
    
    // 2. Direct database query with same logic as API
    console.log('\n💾 Direct Database Query with pagination...');
    
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
    
    console.log(`  Total Records Fetched: ${allData.length}`);
    
    // Count providers with same logic as API
    const providerCount = {};
    const rsmData = {};
    
    allData.forEach(row => {
      const rsm = String(row.rsm || "").trim();
      const provider = String(row.provider || "").trim();
      
      // Count all providers
      if (provider) {
        providerCount[provider] = (providerCount[provider] || 0) + 1;
      }
      
      // RSM grouping (same as API)
      if (!rsm) return; // Skip records without RSM
      
      if (!rsmData[rsm]) {
        rsmData[rsm] = { "WW-Provider": 0, "True Tech": 0, "เถ้าแก่เทค": 0, "อื่นๆ": 0 };
      }
      
      const trimmedProvider = provider.trim();
      if (trimmedProvider === "WW-Provider") {
        rsmData[rsm]["WW-Provider"]++;
      } else if (trimmedProvider === "True Tech") {
        rsmData[rsm]["True Tech"]++;
      } else if (trimmedProvider === "เถ้าแก่เทค") {
        rsmData[rsm]["เถ้าแก่เทค"]++;
      } else if (trimmedProvider) {
        rsmData[rsm]["อื่นๆ"]++;
      } else {
        rsmData[rsm]["อื่นๆ"]++;
      }
    });
    
    // Calculate totals from RSM grouping
    const allTotals = Object.values(rsmData);
    const totalWWProvider = allTotals.reduce((sum, item) => sum + item["WW-Provider"], 0);
    const totalTrueTech = allTotals.reduce((sum, item) => sum + item["True Tech"], 0);
    const totalTaoKae = allTotals.reduce((sum, item) => sum + item["เถ้าแก่เทค"], 0);
    
    console.log('\nDirect DB with RSM filtering (same as API):');
    console.log(`  Records with RSM: ${Object.values(rsmData).reduce((sum, item) => sum + item["WW-Provider"] + item["True Tech"] + item["เถ้าแก่เทค"] + item["อื่นๆ"], 0)}`);
    console.log(`  WW-Provider: ${totalWWProvider}`);
    console.log(`  True Tech: ${totalTrueTech}`);
    console.log(`  เถ้าแก่เทค: ${totalTaoKae}`);
    
    console.log('\nDirect DB all providers (no RSM filter):');
    console.log(`  WW-Provider: ${providerCount['WW-Provider'] || 0}`);
    console.log(`  True Tech: ${providerCount['True Tech'] || 0}`);
    console.log(`  เถ้าแก่เทค: ${providerCount['เถ้าแก่เทค'] || 0}`);
    
    // Check for differences
    console.log('\n🔍 Analysis:');
    const apiWW = apiData.summary?.providers?.['WW-Provider'] || 0;
    const dbWW = totalWWProvider;
    const directWW = providerCount['WW-Provider'] || 0;
    
    console.log(`API WW-Provider: ${apiWW}`);
    console.log(`DB with RSM filter: ${dbWW}`);
    console.log(`DB without RSM filter: ${directWW}`);
    
    if (apiWW !== dbWW) {
      console.log(`❌ API and DB with RSM filter don't match! Difference: ${apiWW - dbWW}`);
    }
    
    if (directWW !== dbWW) {
      console.log(`❌ Records without RSM detected! Missing: ${directWW - dbWW} WW-Provider records`);
      
      // Find records without RSM
      const recordsWithoutRSM = allData.filter(row => !String(row.rsm || "").trim());
      console.log(`Records without RSM: ${recordsWithoutRSM.length}`);
      
      const wwProviderWithoutRSM = recordsWithoutRSM.filter(row => String(row.provider || "").trim() === "WW-Provider");
      console.log(`WW-Provider records without RSM: ${wwProviderWithoutRSM.length}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

compareData();
