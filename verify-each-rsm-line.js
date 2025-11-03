const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyEachRSM() {
  console.log('🔍 Verifying Each RSM Line by Line...\n');
  
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
    
    console.log(`Total records: ${allData.length}`);
    console.log(`Total หัวหน้า: ${headsOnly.length}\n`);
    
    // Build counts per RSM
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
    
    // Screenshot data (from latest image)
    const screenshot = {
      'RSM1_BMA-West': {
        'WW-Provider_Installation': 170,
        'WW-Provider_Repair': 38,
        'True Tech_Installation': 7,
        'True Tech_Repair': 123,
        'เถ้าแก่เทค_Installation': 2,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM2_BMA-East': {
        'WW-Provider_Installation': 299,
        'WW-Provider_Repair': 35,
        'True Tech_Installation': 20,
        'True Tech_Repair': 347,
        'เถ้าแก่เทค_Installation': 0,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM3_UPC-East': {
        'WW-Provider_Installation': 8,
        'WW-Provider_Repair': 1,
        'True Tech_Installation': 0,
        'True Tech_Repair': 45,
        'เถ้าแก่เทค_Installation': 3,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM4_UPC-NOR': {
        'WW-Provider_Installation': 0,
        'WW-Provider_Repair': 0,
        'True Tech_Installation': 18,
        'True Tech_Repair': 41,
        'เถ้าแก่เทค_Installation': 0,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM5_UPC-NOE1': {
        'WW-Provider_Installation': 10,
        'WW-Provider_Repair': 1,
        'True Tech_Installation': 9,
        'True Tech_Repair': 30,
        'เถ้าแก่เทค_Installation': 0,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM6_UPC-NOE2': {
        'WW-Provider_Installation': 36,
        'WW-Provider_Repair': 36,
        'True Tech_Installation': 23,
        'True Tech_Repair': 38,
        'เถ้าแก่เทค_Installation': 0,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM7_UPC-CEW': {
        'WW-Provider_Installation': 142,
        'WW-Provider_Repair': 34,
        'True Tech_Installation': 0,
        'True Tech_Repair': 94,
        'เถ้าแก่เทค_Installation': 1,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM8_UPC-SOU': {
        'WW-Provider_Installation': 83,
        'WW-Provider_Repair': 30,
        'True Tech_Installation': 28,
        'True Tech_Repair': 71,
        'เถ้าแก่เทค_Installation': 3,
        'เถ้าแก่เทค_Repair': 0
      }
    };
    
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('LINE-BY-LINE VERIFICATION (หัวหน้ากองงาน - Red Numbers)');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    
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
    const workTypes = ['Installation', 'Repair'];
    
    rsms.forEach(rsm => {
      console.log(`\n${rsm}:`);
      console.log('─────────────────────────────────────────────────────────────────────');
      
      let rsmScreenTotal = 0;
      let rsmApiTotal = 0;
      
      providers.forEach(provider => {
        let providerScreenTotal = 0;
        let providerApiTotal = 0;
        
        workTypes.forEach(workType => {
          const key = `${provider}_${workType}`;
          const apiVal = result[rsm]?.[key] || 0;
          const screenVal = screenshot[rsm]?.[key] || 0;
          
          providerScreenTotal += screenVal;
          providerApiTotal += apiVal;
          
          const status = apiVal === screenVal ? '✅' : '❌';
          const diff = apiVal - screenVal;
          
          console.log(
            `  ${provider.padEnd(15)} ${workType.padEnd(12)} ` +
            `Screen: ${String(screenVal).padStart(4)} | ` +
            `API: ${String(apiVal).padStart(4)} | ` +
            `Diff: ${diff >= 0 ? '+' : ''}${String(diff).padStart(4)} ${status}`
          );
        });
        
        rsmScreenTotal += providerScreenTotal;
        rsmApiTotal += providerApiTotal;
        
        console.log(
          `  ${provider.padEnd(15)} ${'TOTAL'.padEnd(12)} ` +
          `Screen: ${String(providerScreenTotal).padStart(4)} | ` +
          `API: ${String(providerApiTotal).padStart(4)} | ` +
          `Diff: ${providerApiTotal - providerScreenTotal >= 0 ? '+' : ''}${String(providerApiTotal - providerScreenTotal).padStart(4)}`
        );
      });
      
      console.log('─────────────────────────────────────────────────────────────────────');
      console.log(
        `  ${'RSM TOTAL'.padEnd(28)} ` +
        `Screen: ${String(rsmScreenTotal).padStart(4)} | ` +
        `API: ${String(rsmApiTotal).padStart(4)} | ` +
        `Diff: ${rsmApiTotal - rsmScreenTotal >= 0 ? '+' : ''}${String(rsmApiTotal - rsmScreenTotal).padStart(4)}`
      );
    });
    
    // Grand totals
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('GRAND TOTALS (Red Numbers):');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    
    const grandTotals = { screen: {}, api: {} };
    
    providers.forEach(provider => {
      grandTotals.screen[provider] = { Installation: 0, Repair: 0, Total: 0 };
      grandTotals.api[provider] = { Installation: 0, Repair: 0, Total: 0 };
      
      workTypes.forEach(workType => {
        const key = `${provider}_${workType}`;
        rsms.forEach(rsm => {
          grandTotals.screen[provider][workType] += screenshot[rsm]?.[key] || 0;
          grandTotals.api[provider][workType] += result[rsm]?.[key] || 0;
        });
      });
      
      grandTotals.screen[provider].Total = grandTotals.screen[provider].Installation + grandTotals.screen[provider].Repair;
      grandTotals.api[provider].Total = grandTotals.api[provider].Installation + grandTotals.api[provider].Repair;
    });
    
    providers.forEach(provider => {
      console.log(`${provider}:`);
      
      workTypes.forEach(workType => {
        const screenVal = grandTotals.screen[provider][workType];
        const apiVal = grandTotals.api[provider][workType];
        const status = apiVal === screenVal ? '✅' : '❌';
        const diff = apiVal - screenVal;
        
        console.log(
          `  ${workType.padEnd(12)} Screen: ${String(screenVal).padStart(4)} | ` +
          `API: ${String(apiVal).padStart(4)} | ` +
          `Diff: ${diff >= 0 ? '+' : ''}${String(diff).padStart(4)} ${status}`
        );
      });
      
      const totalStatus = grandTotals.api[provider].Total === grandTotals.screen[provider].Total ? '✅' : '❌';
      const totalDiff = grandTotals.api[provider].Total - grandTotals.screen[provider].Total;
      
      console.log(
        `  ${'TOTAL'.padEnd(12)} Screen: ${String(grandTotals.screen[provider].Total).padStart(4)} | ` +
        `API: ${String(grandTotals.api[provider].Total).padStart(4)} | ` +
        `Diff: ${totalDiff >= 0 ? '+' : ''}${String(totalDiff).padStart(4)} ${totalStatus}\n`
      );
    });
    
    const screenGrandTotal = Object.values(grandTotals.screen).reduce((sum, p) => sum + p.Total, 0);
    const apiGrandTotal = Object.values(grandTotals.api).reduce((sum, p) => sum + p.Total, 0);
    
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(
      `GRAND TOTAL:          Screen: ${String(screenGrandTotal).padStart(4)} | ` +
      `API: ${String(apiGrandTotal).padStart(4)} | ` +
      `Diff: ${apiGrandTotal - screenGrandTotal >= 0 ? '+' : ''}${String(apiGrandTotal - screenGrandTotal).padStart(4)} ` +
      `${apiGrandTotal === screenGrandTotal ? '✅' : '❌'}`
    );
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    
    console.log('📋 Expected values for Grand Total row (Red Numbers):');
    console.log(`  WW-Provider Installation: ${grandTotals.api['WW-Provider'].Installation} (Screen shows: ${grandTotals.screen['WW-Provider'].Installation})`);
    console.log(`  WW-Provider Repair: ${grandTotals.api['WW-Provider'].Repair} (Screen shows: ${grandTotals.screen['WW-Provider'].Repair})`);
    console.log(`  WW-Provider Total: ${grandTotals.api['WW-Provider'].Total} (Screen shows: ${grandTotals.screen['WW-Provider'].Total})`);
    console.log(`  True Tech Installation: ${grandTotals.api['True Tech'].Installation} (Screen shows: ${grandTotals.screen['True Tech'].Installation})`);
    console.log(`  True Tech Repair: ${grandTotals.api['True Tech'].Repair} (Screen shows: ${grandTotals.screen['True Tech'].Repair})`);
    console.log(`  True Tech Total: ${grandTotals.api['True Tech'].Total} (Screen shows: ${grandTotals.screen['True Tech'].Total})`);
    console.log(`  เถ้าแก่เทค Installation: ${grandTotals.api['เถ้าแก่เทค'].Installation} (Screen shows: ${grandTotals.screen['เถ้าแก่เทค'].Installation})`);
    console.log(`  เถ้าแก่เทค Repair: ${grandTotals.api['เถ้าแก่เทค'].Repair} (Screen shows: ${grandTotals.screen['เถ้าแก่เทค'].Repair})`);
    console.log(`  เถ้าแก่เทค Total: ${grandTotals.api['เถ้าแก่เทค'].Total} (Screen shows: ${grandTotals.screen['เถ้าแก่เทค'].Total})`);
    console.log(`  GRAND TOTAL: ${apiGrandTotal} (Screen shows: ${screenGrandTotal})`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyEachRSM();
