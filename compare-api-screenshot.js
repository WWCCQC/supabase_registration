const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function compareWithScreenshot() {
  console.log('🔍 Comparing API data with Screenshot...\n');
  
  try {
    // Fetch all data
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
    
    // Build result
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
    
    // Screenshot data (red numbers only)
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
        'WW-Provider_Installation': 234,
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
        'True Tech_Installation': 19,
        'True Tech_Repair': 30,
        'เถ้าแก่เทค_Installation': 0,
        'เถ้าแก่เทค_Repair': 0
      },
      'RSM6_UPC-NOE2': {
        'WW-Provider_Installation': 0,
        'WW-Provider_Repair': 0,
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
    
    console.log('📊 Comparison Table:');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('RSM / Provider_WorkType'.padEnd(40) + 'API'.padEnd(10) + 'Screenshot'.padEnd(15) + 'Difference');
    console.log('───────────────────────────────────────────────────────────────────────────');
    
    const rsms = Object.keys(screenshot).sort();
    let totalDiff = 0;
    
    rsms.forEach(rsm => {
      console.log(`\n${rsm}:`);
      
      const keys = ['WW-Provider_Installation', 'WW-Provider_Repair', 
                    'True Tech_Installation', 'True Tech_Repair',
                    'เถ้าแก่เทค_Installation', 'เถ้าแก่เทค_Repair'];
      
      keys.forEach(key => {
        const apiVal = result[rsm]?.[key] || 0;
        const screenVal = screenshot[rsm][key];
        const diff = apiVal - screenVal;
        totalDiff += diff;
        
        const marker = diff !== 0 ? (diff > 0 ? ' ⬆️' : ' ⬇️') : '';
        console.log(
          `  ${key}`.padEnd(40) +
          String(apiVal).padEnd(10) +
          String(screenVal).padEnd(15) +
          (diff > 0 ? `+${diff}` : diff) + marker
        );
      });
    });
    
    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log(`Total Difference: ${totalDiff > 0 ? '+' : ''}${totalDiff}`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    
    // Calculate grand totals
    const apiGrandTotals = { 'WW-Provider': { Install: 0, Repair: 0 }, 'True Tech': { Install: 0, Repair: 0 }, 'เถ้าแก่เทค': { Install: 0, Repair: 0 } };
    const screenGrandTotals = { 'WW-Provider': { Install: 0, Repair: 0 }, 'True Tech': { Install: 0, Repair: 0 }, 'เถ้าแก่เทค': { Install: 0, Repair: 0 } };
    
    rsms.forEach(rsm => {
      apiGrandTotals['WW-Provider'].Install += result[rsm]?.['WW-Provider_Installation'] || 0;
      apiGrandTotals['WW-Provider'].Repair += result[rsm]?.['WW-Provider_Repair'] || 0;
      apiGrandTotals['True Tech'].Install += result[rsm]?.['True Tech_Installation'] || 0;
      apiGrandTotals['True Tech'].Repair += result[rsm]?.['True Tech_Repair'] || 0;
      apiGrandTotals['เถ้าแก่เทค'].Install += result[rsm]?.['เถ้าแก่เทค_Installation'] || 0;
      apiGrandTotals['เถ้าแก่เทค'].Repair += result[rsm]?.['เถ้าแก่เทค_Repair'] || 0;
      
      screenGrandTotals['WW-Provider'].Install += screenshot[rsm]['WW-Provider_Installation'];
      screenGrandTotals['WW-Provider'].Repair += screenshot[rsm]['WW-Provider_Repair'];
      screenGrandTotals['True Tech'].Install += screenshot[rsm]['True Tech_Installation'];
      screenGrandTotals['True Tech'].Repair += screenshot[rsm]['True Tech_Repair'];
      screenGrandTotals['เถ้าแก่เทค'].Install += screenshot[rsm]['เถ้าแก่เทค_Installation'];
      screenGrandTotals['เถ้าแก่เทค'].Repair += screenshot[rsm]['เถ้าแก่เทค_Repair'];
    });
    
    console.log('📊 Grand Totals:');
    console.log('Provider / WorkType'.padEnd(30) + 'API'.padEnd(15) + 'Screenshot'.padEnd(15) + 'Difference');
    console.log('─────────────────────────────────────────────────────────────────────');
    
    ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'].forEach(provider => {
      console.log(`\n${provider}:`);
      console.log(
        '  Installation'.padEnd(30) +
        String(apiGrandTotals[provider].Install).padEnd(15) +
        String(screenGrandTotals[provider].Install).padEnd(15) +
        (apiGrandTotals[provider].Install - screenGrandTotals[provider].Install)
      );
      console.log(
        '  Repair'.padEnd(30) +
        String(apiGrandTotals[provider].Repair).padEnd(15) +
        String(screenGrandTotals[provider].Repair).padEnd(15) +
        (apiGrandTotals[provider].Repair - screenGrandTotals[provider].Repair)
      );
      
      const apiTotal = apiGrandTotals[provider].Install + apiGrandTotals[provider].Repair;
      const screenTotal = screenGrandTotals[provider].Install + screenGrandTotals[provider].Repair;
      console.log(
        '  TOTAL'.padEnd(30) +
        String(apiTotal).padEnd(15) +
        String(screenTotal).padEnd(15) +
        (apiTotal - screenTotal)
      );
    });
    
    const apiGrand = Object.values(apiGrandTotals).reduce((sum, p) => sum + p.Install + p.Repair, 0);
    const screenGrand = Object.values(screenGrandTotals).reduce((sum, p) => sum + p.Install + p.Repair, 0);
    
    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log('GRAND TOTAL'.padEnd(30) + String(apiGrand).padEnd(15) + String(screenGrand).padEnd(15) + (apiGrand - screenGrand));
    console.log('═════════════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

compareWithScreenshot();
