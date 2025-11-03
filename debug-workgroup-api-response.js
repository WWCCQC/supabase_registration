const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugWorkgroupAPI() {
  console.log('🔍 Debugging Workgroup API Response...\n');
  
  try {
    // Fetch exactly what the API does
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type, workgroup_status, national_id')
        .not('rsm', 'is', null)
        .not('provider', 'is', null)
        .not('work_type', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      page++;
    }
    
    // Filter หัวหน้า
    const headsOnly = allData.filter((row) => {
      const status = row.workgroup_status || "";
      return status.startsWith("ห");
    });
    
    console.log(`Total records: ${allData.length}`);
    console.log(`Total หัวหน้า: ${headsOnly.length}\n`);
    
    // Build result exactly like API
    const result = {};
    
    headsOnly.forEach((row) => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";

      if (!result[rsm]) {
        result[rsm] = {};
      }

      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        if (!result[rsm][key]) {
          result[rsm][key] = 0;
        }
        result[rsm][key]++;
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        if (!result[rsm][key]) {
          result[rsm][key] = 0;
        }
        result[rsm][key]++;
      }
    });

    // Calculate provider totals
    Object.keys(result).forEach(rsm => {
      const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
      providers.forEach(provider => {
        const installCount = result[rsm][`${provider}_Installation`] || 0;
        const repairCount = result[rsm][`${provider}_Repair`] || 0;
        result[rsm][provider] = installCount + repairCount;
      });
    });
    
    // Display results
    console.log('📊 API Response Structure:\n');
    
    // Check RSM1_BMA-West specifically (from screenshot)
    const rsm1 = result['RSM1_BMA-West'];
    if (rsm1) {
      console.log('RSM1_BMA-West:');
      console.log(`  WW-Provider Total: ${rsm1['WW-Provider'] || 0}`);
      console.log(`    Installation: ${rsm1['WW-Provider_Installation'] || 0}`);
      console.log(`    Repair: ${rsm1['WW-Provider_Repair'] || 0}`);
      console.log(`  True Tech Total: ${rsm1['True Tech'] || 0}`);
      console.log(`    Installation: ${rsm1['True Tech_Installation'] || 0}`);
      console.log(`    Repair: ${rsm1['True Tech_Repair'] || 0}`);
      console.log(`  เถ้าแก่เทค Total: ${rsm1['เถ้าแก่เทค'] || 0}`);
      console.log(`    Installation: ${rsm1['เถ้าแก่เทค_Installation'] || 0}`);
      console.log(`    Repair: ${rsm1['เถ้าแก่เทค_Repair'] || 0}\n`);
    }
    
    // Calculate grand totals by provider
    const grandTotals = {
      'WW-Provider': { Installation: 0, Repair: 0, Total: 0 },
      'True Tech': { Installation: 0, Repair: 0, Total: 0 },
      'เถ้าแก่เทค': { Installation: 0, Repair: 0, Total: 0 }
    };
    
    Object.keys(result).forEach(rsm => {
      ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'].forEach(provider => {
        grandTotals[provider].Installation += result[rsm][`${provider}_Installation`] || 0;
        grandTotals[provider].Repair += result[rsm][`${provider}_Repair`] || 0;
        grandTotals[provider].Total += result[rsm][provider] || 0;
      });
    });
    
    console.log('📊 Grand Totals from API:');
    console.log('═══════════════════════════════════════════════════');
    console.log('Provider'.padEnd(20) + 'Installation'.padEnd(15) + 'Repair'.padEnd(15) + 'Total');
    console.log('───────────────────────────────────────────────────');
    Object.keys(grandTotals).forEach(provider => {
      console.log(
        provider.padEnd(20) +
        String(grandTotals[provider].Installation).padEnd(15) +
        String(grandTotals[provider].Repair).padEnd(15) +
        grandTotals[provider].Total
      );
    });
    
    const total = Object.values(grandTotals).reduce((sum, p) => sum + p.Total, 0);
    console.log('═══════════════════════════════════════════════════');
    console.log('TOTAL'.padEnd(20) + ''.padEnd(30) + total);
    console.log('═══════════════════════════════════════════════════\n');
    
    // Compare with screenshot
    console.log('📸 Comparison with Screenshot:');
    console.log('Expected from screenshot Grand Total row:');
    console.log('  WW-Provider: 1,819(798) Installation + 261(175) Repair = 2,080(973)');
    console.log('  True Tech: 138(105) Installation + 668(789) Repair = 806(894)');
    console.log('  เถ้าแก่เทค: 52(18) Installation + 0(0) Repair = 52(18)');
    console.log('  Total: 2,938(1,790)\n');
    
    console.log('API returns (should match red numbers):');
    console.log(`  WW-Provider: ${grandTotals['WW-Provider'].Installation}(?) Installation + ${grandTotals['WW-Provider'].Repair}(?) Repair = ${grandTotals['WW-Provider'].Total}(973 expected)`);
    console.log(`  True Tech: ${grandTotals['True Tech'].Installation}(?) Installation + ${grandTotals['True Tech'].Repair}(?) Repair = ${grandTotals['True Tech'].Total}(894 expected)`);
    console.log(`  เถ้าแก่เทค: ${grandTotals['เถ้าแก่เทค'].Installation}(?) Installation + ${grandTotals['เถ้าแก่เทค'].Repair}(?) Repair = ${grandTotals['เถ้าแก่เทค'].Total}(18 expected)`);
    console.log(`  Total: ${total} (1,790 expected)\n`);
    
    // Check if numbers match
    if (grandTotals['WW-Provider'].Total === 973 &&
        grandTotals['True Tech'].Total === 894 &&
        grandTotals['เถ้าแก่เทค'].Total === 18 &&
        total === 1885) {
      console.log('❌ PROBLEM FOUND: API returns 1,885 but should return 1,790!');
      console.log('   Difference: 95 records too many\n');
      
      // Let's check what's wrong - maybe counting both Installation AND Repair totals?
      console.log('💡 Checking if double-counting issue...');
      
    } else {
      console.log('✅ API returns correct numbers');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugWorkgroupAPI();
