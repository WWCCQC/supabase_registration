const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function compareWithScreenshot() {
  console.log('📊 Comparing Pivot Table with Screenshot Data...\n');
  
  // Data from screenshot
  const screenshotData = {
    'Grand Total': { total: 2938, wwTotal: 1761, wwInstall: 1525, wwRepair: 236, ttTotal: 357, ttInstall: 68, ttRepair: 289, tkTotal: 52, tkInstall: 52, tkRepair: 0 },
    'RSM1_BMA-West': { total: 399, wwTotal: 151, wwInstall: 132, wwRepair: 19, ttTotal: 104, ttInstall: 10, ttRepair: 94, tkTotal: 4, tkInstall: 4, tkRepair: 0 },
    'RSM2_BMA-East': { total: 637, wwTotal: 141, wwInstall: 121, wwRepair: 20, ttTotal: 47, ttInstall: 0, ttRepair: 47, tkTotal: 18, tkInstall: 18, tkRepair: 0 },
    'RSM3_UPC-East': { total: 344, wwTotal: 253, wwInstall: 236, wwRepair: 17, ttTotal: 54, ttInstall: 0, ttRepair: 54, tkTotal: 20, tkInstall: 20, tkRepair: 0 },
    'RSM4_UPC-NOR': { total: 331, wwTotal: 250, wwInstall: 213, wwRepair: 39, ttTotal: 77, ttInstall: 36, ttRepair: 41, tkTotal: 2, tkInstall: 2, tkRepair: 0 },
    'RSM5_UPC-NOE1': { total: 293, wwTotal: 228, wwInstall: 190, wwRepair: 36, ttTotal: 65, ttInstall: 19, ttRepair: 46, tkTotal: 0, tkInstall: 0, tkRepair: 0 },
    'RSM6_UPC-NOE2': { total: 269, wwTotal: 217, wwInstall: 181, wwRepair: 36, ttTotal: 5, ttInstall: 3, ttRepair: 2, tkTotal: 0, tkInstall: 0, tkRepair: 0 },
    'RSM7_UPC-CEW': { total: 387, wwTotal: 321, wwInstall: 285, wwRepair: 36, ttTotal: 3, ttInstall: 0, ttRepair: 3, tkTotal: 2, tkInstall: 2, tkRepair: 0 },
    'RSM8_UPC-SOU': { total: 278, wwTotal: 200, wwInstall: 167, wwRepair: 33, ttTotal: 2, ttInstall: 0, ttRepair: 2, tkTotal: 6, tkInstall: 6, tkRepair: 0 }
  };
  
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
    
    console.log(`✅ Total records fetched from Supabase: ${allData.length}\n`);
    
    // Group by RSM, Provider, Work Type
    const actualData = {};
    
    allData.forEach(item => {
      if (!item.rsm || !item.provider || !item.work_type) return;
      
      const rsm = item.rsm;
      const provider = item.provider;
      const workType = item.work_type;
      
      if (!actualData[rsm]) {
        actualData[rsm] = {};
      }
      
      if (!actualData[rsm][provider]) {
        actualData[rsm][provider] = {
          Installation: 0,
          Repair: 0,
          Total: 0
        };
      }
      
      if (workType === 'Installation') {
        actualData[rsm][provider].Installation++;
      } else if (workType === 'Repair') {
        actualData[rsm][provider].Repair++;
      }
      
      actualData[rsm][provider].Total++;
    });
    
    console.log('🔍 Comparison Results:\n');
    console.log('═'.repeat(100));
    console.log('RSM / Provider'.padEnd(30) + 'Screenshot'.padEnd(20) + 'Actual DB'.padEnd(20) + 'Match?');
    console.log('═'.repeat(100));
    
    let hasMismatch = false;
    
    // Check each RSM
    const rsms = ['RSM1_BMA-West', 'RSM2_BMA-East', 'RSM3_UPC-East', 'RSM4_UPC-NOR', 'RSM5_UPC-NOE1', 'RSM6_UPC-NOE2', 'RSM7_UPC-CEW', 'RSM8_UPC-SOU'];
    
    rsms.forEach(rsm => {
      const screenshot = screenshotData[rsm];
      const actual = actualData[rsm] || {};
      
      const wwActual = actual['WW-Provider'] || { Total: 0, Installation: 0, Repair: 0 };
      const ttActual = actual['True Tech'] || { Total: 0, Installation: 0, Repair: 0 };
      const tkActual = actual['เถ้าแก่เทค'] || { Total: 0, Installation: 0, Repair: 0 };
      
      const actualTotal = wwActual.Total + ttActual.Total + tkActual.Total;
      
      // Check RSM Total
      const totalMatch = screenshot.total === actualTotal ? '✅' : '❌';
      if (screenshot.total !== actualTotal) {
        hasMismatch = true;
        console.log(`${rsm} Total`.padEnd(30) + String(screenshot.total).padEnd(20) + String(actualTotal).padEnd(20) + totalMatch);
      }
      
      // Check WW-Provider
      if (screenshot.wwTotal !== wwActual.Total) {
        hasMismatch = true;
        console.log(`  WW-Provider Total`.padEnd(30) + String(screenshot.wwTotal).padEnd(20) + String(wwActual.Total).padEnd(20) + '❌');
      }
      if (screenshot.wwInstall !== wwActual.Installation) {
        hasMismatch = true;
        console.log(`  WW-Provider Install`.padEnd(30) + String(screenshot.wwInstall).padEnd(20) + String(wwActual.Installation).padEnd(20) + '❌');
      }
      if (screenshot.wwRepair !== wwActual.Repair) {
        hasMismatch = true;
        console.log(`  WW-Provider Repair`.padEnd(30) + String(screenshot.wwRepair).padEnd(20) + String(wwActual.Repair).padEnd(20) + '❌');
      }
      
      // Check True Tech
      if (screenshot.ttTotal !== ttActual.Total) {
        hasMismatch = true;
        console.log(`  True Tech Total`.padEnd(30) + String(screenshot.ttTotal).padEnd(20) + String(ttActual.Total).padEnd(20) + '❌');
      }
      if (screenshot.ttInstall !== ttActual.Installation) {
        hasMismatch = true;
        console.log(`  True Tech Install`.padEnd(30) + String(screenshot.ttInstall).padEnd(20) + String(ttActual.Installation).padEnd(20) + '❌');
      }
      if (screenshot.ttRepair !== ttActual.Repair) {
        hasMismatch = true;
        console.log(`  True Tech Repair`.padEnd(30) + String(screenshot.ttRepair).padEnd(20) + String(ttActual.Repair).padEnd(20) + '❌');
      }
    });
    
    console.log('═'.repeat(100));
    
    if (!hasMismatch) {
      console.log('\n✅ All data matches perfectly!');
    } else {
      console.log('\n❌ Found mismatches between screenshot and actual database');
      console.log('\n📊 Actual Grand Totals from DB:');
      
      const grandTotals = {
        'WW-Provider': { Installation: 0, Repair: 0, Total: 0 },
        'True Tech': { Installation: 0, Repair: 0, Total: 0 },
        'เถ้าแก่เทค': { Installation: 0, Repair: 0, Total: 0 }
      };
      
      Object.keys(actualData).forEach(rsm => {
        const ww = actualData[rsm]['WW-Provider'] || { Total: 0, Installation: 0, Repair: 0 };
        const tt = actualData[rsm]['True Tech'] || { Total: 0, Installation: 0, Repair: 0 };
        const tk = actualData[rsm]['เถ้าแก่เทค'] || { Total: 0, Installation: 0, Repair: 0 };
        
        grandTotals['WW-Provider'].Total += ww.Total;
        grandTotals['WW-Provider'].Installation += ww.Installation;
        grandTotals['WW-Provider'].Repair += ww.Repair;
        
        grandTotals['True Tech'].Total += tt.Total;
        grandTotals['True Tech'].Installation += tt.Installation;
        grandTotals['True Tech'].Repair += tt.Repair;
        
        grandTotals['เถ้าแก่เทค'].Total += tk.Total;
        grandTotals['เถ้าแก่เทค'].Installation += tk.Installation;
        grandTotals['เถ้าแก่เทค'].Repair += tk.Repair;
      });
      
      console.log('WW-Provider:', grandTotals['WW-Provider']);
      console.log('True Tech:', grandTotals['True Tech']);
      console.log('เถ้าแก่เทค:', grandTotals['เถ้าแก่เทค']);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

compareWithScreenshot();
