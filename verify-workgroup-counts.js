const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyWorkgroupCounts() {
  console.log('📊 Verifying Workgroup Counts from Supabase...\n');
  
  try {
    // Fetch all technicians with workgroup_status = "หัวหน้า"
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type, workgroup_status, national_id')
        .eq('workgroup_status', 'หัวหน้า')
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
    
    console.log(`✅ Total หัวหน้า (workgroup heads) fetched: ${allData.length}\n`);
    
    // Group by RSM, Provider, Work Type
    const workgroupData = {};
    
    allData.forEach(item => {
      const rsm = item.rsm;
      const provider = item.provider;
      const workType = item.work_type;
      
      if (!workgroupData[rsm]) {
        workgroupData[rsm] = {};
      }
      
      // Count by provider_worktype
      const key = `${provider}_${workType}`;
      if (!workgroupData[rsm][key]) {
        workgroupData[rsm][key] = 0;
      }
      workgroupData[rsm][key]++;
      
      // Count by provider total
      if (!workgroupData[rsm][provider]) {
        workgroupData[rsm][provider] = 0;
      }
      workgroupData[rsm][provider]++;
    });
    
    // Calculate totals
    const grandTotals = {
      'WW-Provider': { Installation: 0, Repair: 0, Total: 0 },
      'True Tech': { Installation: 0, Repair: 0, Total: 0 },
      'เถ้าแก่เทค': { Installation: 0, Repair: 0, Total: 0 }
    };
    
    const rsmTotals = {};
    
    // Print results in table format
    console.log('═'.repeat(140));
    console.log('RSM'.padEnd(20) + 
                'Grand Total'.padEnd(15) + 
                'WW-Provider'.padEnd(35) + 
                'True Tech'.padEnd(35) + 
                'เถ้าแก่เทค'.padEnd(35));
    console.log(' '.repeat(35) + 
                'Total'.padEnd(12) + 'Install'.padEnd(12) + 'Repair'.padEnd(11) + 
                'Total'.padEnd(12) + 'Install'.padEnd(12) + 'Repair'.padEnd(11) + 
                'Total'.padEnd(12) + 'Install'.padEnd(12) + 'Repair');
    console.log('═'.repeat(140));
    
    // Sort RSM
    const sortedRSMs = Object.keys(workgroupData).sort();
    
    sortedRSMs.forEach(rsm => {
      const wwProvider = {
        Installation: workgroupData[rsm]['WW-Provider_Installation'] || 0,
        Repair: workgroupData[rsm]['WW-Provider_Repair'] || 0,
        Total: workgroupData[rsm]['WW-Provider'] || 0
      };
      
      const trueTech = {
        Installation: workgroupData[rsm]['True Tech_Installation'] || 0,
        Repair: workgroupData[rsm]['True Tech_Repair'] || 0,
        Total: workgroupData[rsm]['True Tech'] || 0
      };
      
      const taokaeTech = {
        Installation: workgroupData[rsm]['เถ้าแก่เทค_Installation'] || 0,
        Repair: workgroupData[rsm]['เถ้าแก่เทค_Repair'] || 0,
        Total: workgroupData[rsm]['เถ้าแก่เทค'] || 0
      };
      
      const rsmTotal = wwProvider.Total + trueTech.Total + taokaeTech.Total;
      rsmTotals[rsm] = rsmTotal;
      
      // Update grand totals
      grandTotals['WW-Provider'].Installation += wwProvider.Installation;
      grandTotals['WW-Provider'].Repair += wwProvider.Repair;
      grandTotals['WW-Provider'].Total += wwProvider.Total;
      
      grandTotals['True Tech'].Installation += trueTech.Installation;
      grandTotals['True Tech'].Repair += trueTech.Repair;
      grandTotals['True Tech'].Total += trueTech.Total;
      
      grandTotals['เถ้าแก่เทค'].Installation += taokaeTech.Installation;
      grandTotals['เถ้าแก่เทค'].Repair += taokaeTech.Repair;
      grandTotals['เถ้าแก่เทค'].Total += taokaeTech.Total;
      
      console.log(
        rsm.padEnd(20) +
        String(rsmTotal).padEnd(15) +
        String(wwProvider.Total).padEnd(12) +
        String(wwProvider.Installation).padEnd(12) +
        String(wwProvider.Repair).padEnd(11) +
        String(trueTech.Total).padEnd(12) +
        String(trueTech.Installation).padEnd(12) +
        String(trueTech.Repair).padEnd(11) +
        String(taokaeTech.Total).padEnd(12) +
        String(taokaeTech.Installation).padEnd(12) +
        String(taokaeTech.Repair)
      );
    });
    
    console.log('═'.repeat(140));
    
    const overallTotal = grandTotals['WW-Provider'].Total + 
                         grandTotals['True Tech'].Total + 
                         grandTotals['เถ้าแก่เทค'].Total;
    
    console.log(
      'Grand Total'.padEnd(20) +
      String(overallTotal).padEnd(15) +
      String(grandTotals['WW-Provider'].Total).padEnd(12) +
      String(grandTotals['WW-Provider'].Installation).padEnd(12) +
      String(grandTotals['WW-Provider'].Repair).padEnd(11) +
      String(grandTotals['True Tech'].Total).padEnd(12) +
      String(grandTotals['True Tech'].Installation).padEnd(12) +
      String(grandTotals['True Tech'].Repair).padEnd(11) +
      String(grandTotals['เถ้าแก่เทค'].Total).padEnd(12) +
      String(grandTotals['เถ้าแก่เทค'].Installation).padEnd(12) +
      String(grandTotals['เถ้าแก่เทค'].Repair)
    );
    console.log('═'.repeat(140));
    
    console.log('\n📊 Summary:');
    console.log(`Total workgroup heads (หัวหน้า): ${allData.length}`);
    console.log(`Calculated grand total: ${overallTotal}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyWorkgroupCounts();
