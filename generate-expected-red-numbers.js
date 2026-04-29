const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function generateExpectedTable() {
  console.log('📋 Generating Expected Red Numbers for Each RSM Row...\n');
  
  try {
    // Fetch all data
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type, workgroup_status')
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
    
    // Filter หัวหน้า only
    const headsOnly = allData.filter((row) => {
      const status = row.workgroup_status || "";
      return status.startsWith("ห");
    });
    
    console.log(`Total technicians: ${allData.length}`);
    console.log(`Total หัวหน้า (workgroup heads): ${headsOnly.length}\n`);
    
    // Build counts per RSM (API logic without provider totals)
    const result = {};
    
    headsOnly.forEach((row) => {
      const rsm = row.rsm;
      const provider = row.provider;
      const workType = row.work_type;

      if (!result[rsm]) result[rsm] = {};

      const key = `${provider}_${workType}`;
      if (!result[rsm][key]) result[rsm][key] = 0;
      result[rsm][key]++;
    });
    
    const rsms = [
      'RSM1_BMA-West',
      'RSM2_BMA-East', 
      'RSM3_UPC-East',
      'RSM4_UPC-NOR',
      'RSM5_UPC-NOE1',
      'RSM6_UPC-NOE2',
      'RSM7_UPC-CEW',
      'RSM8_UPC-SOU'
    ];
    
    const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
    
    console.log('═══════════════════════════════════════════════════════════════════════════════════════');
    console.log('EXPECTED RED NUMBERS (Workgroup Heads) - Each RSM Row:');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');
    
    let grandTotals = {
      'WW-Provider': { Installation: 0, Repair: 0, Total: 0 },
      'True Tech': { Installation: 0, Repair: 0, Total: 0 },
      'เถ้าแก่เทค': { Installation: 0, Repair: 0, Total: 0 }
    };
    
    rsms.forEach(rsm => {
      const wwInstall = result[rsm]?.['WW-Provider_Installation'] || 0;
      const wwRepair = result[rsm]?.['WW-Provider_Repair'] || 0;
      const wwTotal = wwInstall + wwRepair;
      
      const ttInstall = result[rsm]?.['True Tech_Installation'] || 0;
      const ttRepair = result[rsm]?.['True Tech_Repair'] || 0;
      const ttTotal = ttInstall + ttRepair;
      
      const tkInstall = result[rsm]?.['เถ้าแก่เทค_Installation'] || 0;
      const tkRepair = result[rsm]?.['เถ้าแก่เทค_Repair'] || 0;
      const tkTotal = tkInstall + tkRepair;
      
      const rsmTotal = wwTotal + ttTotal + tkTotal;
      
      // Update grand totals
      grandTotals['WW-Provider'].Installation += wwInstall;
      grandTotals['WW-Provider'].Repair += wwRepair;
      grandTotals['WW-Provider'].Total += wwTotal;
      grandTotals['True Tech'].Installation += ttInstall;
      grandTotals['True Tech'].Repair += ttRepair;
      grandTotals['True Tech'].Total += ttTotal;
      grandTotals['เถ้าแก่เทค'].Installation += tkInstall;
      grandTotals['เถ้าแก่เทค'].Repair += tkRepair;
      grandTotals['เถ้าแก่เทค'].Total += tkTotal;
      
      console.log(`${rsm}:`);
      console.log(`  WW-Provider:`);
      console.log(`    Installation: (${wwInstall})`);
      console.log(`    Repair: (${wwRepair})`);
      console.log(`    Total: (${wwTotal})`);
      console.log(`  True Tech:`);
      console.log(`    Installation: (${ttInstall})`);
      console.log(`    Repair: (${ttRepair})`);
      console.log(`    Total: (${ttTotal})`);
      console.log(`  เถ้าแก่เทค:`);
      console.log(`    Installation: (${tkInstall})`);
      console.log(`    Repair: (${tkRepair})`);
      console.log(`    Total: (${tkTotal})`);
      console.log(`  RSM Total: (${rsmTotal})`);
      console.log('');
    });
    
    console.log('═══════════════════════════════════════════════════════════════════════════════════════');
    console.log('GRAND TOTAL ROW (Red Numbers):');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════');
    console.log(`WW-Provider Installation: (${grandTotals['WW-Provider'].Installation})`);
    console.log(`WW-Provider Repair: (${grandTotals['WW-Provider'].Repair})`);
    console.log(`WW-Provider Total: (${grandTotals['WW-Provider'].Total})`);
    console.log(`True Tech Installation: (${grandTotals['True Tech'].Installation})`);
    console.log(`True Tech Repair: (${grandTotals['True Tech'].Repair})`);
    console.log(`True Tech Total: (${grandTotals['True Tech'].Total})`);
    console.log(`เถ้าแก่เทค Installation: (${grandTotals['เถ้าแก่เทค'].Installation})`);
    console.log(`เถ้าแก่เทค Repair: (${grandTotals['เถ้าแก่เทค'].Repair})`);
    console.log(`เถ้าแก่เทค Total: (${grandTotals['เถ้าแก่เทค'].Total})`);
    
    const finalTotal = grandTotals['WW-Provider'].Total + grandTotals['True Tech'].Total + grandTotals['เถ้าแก่เทค'].Total;
    console.log(`\nGRAND TOTAL: (${finalTotal})`);
    console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');
    
    // Generate copy-paste friendly format
    console.log('📋 COPY THIS TO COMPARE WITH SCREENSHOT:\n');
    console.log('Expected format: RSM | WW Install(red) | WW Repair(red) | TT Install(red) | TT Repair(red) | TK Install(red) | TK Repair(red)\n');
    
    rsms.forEach(rsm => {
      const wwInstall = result[rsm]?.['WW-Provider_Installation'] || 0;
      const wwRepair = result[rsm]?.['WW-Provider_Repair'] || 0;
      const ttInstall = result[rsm]?.['True Tech_Installation'] || 0;
      const ttRepair = result[rsm]?.['True Tech_Repair'] || 0;
      const tkInstall = result[rsm]?.['เถ้าแก่เทค_Installation'] || 0;
      const tkRepair = result[rsm]?.['เถ้าแก่เทค_Repair'] || 0;
      
      console.log(`${rsm.padEnd(20)} | (${String(wwInstall).padStart(3)}) | (${String(wwRepair).padStart(3)}) | (${String(ttInstall).padStart(3)}) | (${String(ttRepair).padStart(3)}) | (${String(tkInstall).padStart(2)}) | (${String(tkRepair).padStart(2)})`);
    });
    
    console.log('─────────────────────────────────────────────────────────────────────────────────────');
    console.log(`${'Grand Total'.padEnd(20)} | (${String(grandTotals['WW-Provider'].Installation).padStart(3)}) | (${String(grandTotals['WW-Provider'].Repair).padStart(3)}) | (${String(grandTotals['True Tech'].Installation).padStart(3)}) | (${String(grandTotals['True Tech'].Repair).padStart(3)}) | (${String(grandTotals['เถ้าแก่เทค'].Installation).padStart(2)}) | (${String(grandTotals['เถ้าแก่เทค'].Repair).padStart(2)}) = (${finalTotal})`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateExpectedTable();
