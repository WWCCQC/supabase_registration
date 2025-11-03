const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyPivotData() {
  console.log('📊 Verifying Pivot Table Data from Supabase...\n');
  
  try {
    // Fetch all technicians data
    let allData = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type')
        .range(from, from + 999);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += 1000;
        hasMore = data.length === 1000;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`✅ Total records fetched: ${allData.length}\n`);
    
    // Group by RSM, Provider, Work Type
    const pivotData = {};
    
    allData.forEach(item => {
      if (!item.rsm || !item.provider || !item.work_type) return;
      
      const rsm = item.rsm;
      const provider = item.provider;
      const workType = item.work_type;
      
      if (!pivotData[rsm]) {
        pivotData[rsm] = {};
      }
      
      if (!pivotData[rsm][provider]) {
        pivotData[rsm][provider] = {
          Installation: 0,
          Repair: 0,
          Total: 0
        };
      }
      
      if (workType === 'Installation') {
        pivotData[rsm][provider].Installation++;
      } else if (workType === 'Repair') {
        pivotData[rsm][provider].Repair++;
      }
      
      pivotData[rsm][provider].Total++;
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
    const sortedRSMs = Object.keys(pivotData).sort();
    
    sortedRSMs.forEach(rsm => {
      const wwProvider = pivotData[rsm]['WW-Provider'] || { Installation: 0, Repair: 0, Total: 0 };
      const trueTech = pivotData[rsm]['True Tech'] || { Installation: 0, Repair: 0, Total: 0 };
      const taokaeTech = pivotData[rsm]['เถ้าแก่เทค'] || { Installation: 0, Repair: 0, Total: 0 };
      
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
    console.log(`Total records with complete data: ${allData.filter(item => item.rsm && item.provider && item.work_type).length}`);
    console.log(`Overall Grand Total: ${overallTotal}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyPivotData();
