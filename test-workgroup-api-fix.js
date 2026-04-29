const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testWorkgroupAPI() {
  console.log('🧪 Testing Workgroup API logic...\n');
  
  try {
    // Fetch all หัวหน้า
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
    
    console.log(`✅ Total records fetched: ${allData.length}`);
    console.log(`✅ Total หัวหน้า: ${headsOnly.length}\n`);
    
    // Test OLD logic (unique national_id)
    const oldResult = {};
    const oldSets = {};
    
    headsOnly.forEach((row) => {
      const rsm = row.rsm;
      const provider = row.provider;
      const workType = row.work_type;
      const nationalId = row.national_id || "";
      
      if (!nationalId) return;
      
      if (!oldSets[rsm]) oldSets[rsm] = {};
      
      const key = `${provider}_${workType}`;
      if (!oldSets[rsm][key]) oldSets[rsm][key] = new Set();
      oldSets[rsm][key].add(nationalId);
    });
    
    // Convert to counts
    Object.keys(oldSets).forEach(rsm => {
      oldResult[rsm] = {};
      Object.keys(oldSets[rsm]).forEach(key => {
        oldResult[rsm][key] = oldSets[rsm][key].size;
      });
      
      // Calculate provider totals
      ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'].forEach(provider => {
        const install = oldResult[rsm][`${provider}_Installation`] || 0;
        const repair = oldResult[rsm][`${provider}_Repair`] || 0;
        oldResult[rsm][provider] = install + repair;
      });
    });
    
    // Test NEW logic (count all records)
    const newResult = {};
    
    headsOnly.forEach((row) => {
      const rsm = row.rsm;
      const provider = row.provider;
      const workType = row.work_type;
      
      if (!newResult[rsm]) newResult[rsm] = {};
      
      const key = `${provider}_${workType}`;
      if (!newResult[rsm][key]) newResult[rsm][key] = 0;
      newResult[rsm][key]++;
    });
    
    // Calculate provider totals
    Object.keys(newResult).forEach(rsm => {
      ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'].forEach(provider => {
        const install = newResult[rsm][`${provider}_Installation`] || 0;
        const repair = newResult[rsm][`${provider}_Repair`] || 0;
        newResult[rsm][provider] = install + repair;
      });
    });
    
    // Compare results for RSM1_BMA-West
    console.log('📊 Comparison for RSM1_BMA-West (หัวหน้า only):');
    console.log('══════════════════════════════════════════════════════════');
    console.log('Provider_WorkType'.padEnd(30) + 'OLD (unique)'.padEnd(15) + 'NEW (all records)'.padEnd(20) + 'Difference');
    console.log('══════════════════════════════════════════════════════════');
    
    const rsm = 'RSM1_BMA-West';
    const keys = Array.from(new Set([
      ...Object.keys(oldResult[rsm] || {}),
      ...Object.keys(newResult[rsm] || {})
    ])).sort();
    
    keys.forEach(key => {
      const oldVal = oldResult[rsm]?.[key] || 0;
      const newVal = newResult[rsm]?.[key] || 0;
      const diff = newVal - oldVal;
      console.log(
        key.padEnd(30) +
        String(oldVal).padEnd(15) +
        String(newVal).padEnd(20) +
        (diff > 0 ? `+${diff}` : diff)
      );
    });
    
    // Calculate grand totals
    console.log('\n📊 Grand Totals Comparison (หัวหน้า):');
    console.log('══════════════════════════════════════════════════════════');
    
    const oldGrandTotals = { 'WW-Provider': 0, 'True Tech': 0, 'เถ้าแก่เทค': 0 };
    const newGrandTotals = { 'WW-Provider': 0, 'True Tech': 0, 'เถ้าแก่เทค': 0 };
    
    Object.keys(oldResult).forEach(rsm => {
      oldGrandTotals['WW-Provider'] += oldResult[rsm]['WW-Provider'] || 0;
      oldGrandTotals['True Tech'] += oldResult[rsm]['True Tech'] || 0;
      oldGrandTotals['เถ้าแก่เทค'] += oldResult[rsm]['เถ้าแก่เทค'] || 0;
    });
    
    Object.keys(newResult).forEach(rsm => {
      newGrandTotals['WW-Provider'] += newResult[rsm]['WW-Provider'] || 0;
      newGrandTotals['True Tech'] += newResult[rsm]['True Tech'] || 0;
      newGrandTotals['เถ้าแก่เทค'] += newResult[rsm]['เถ้าแก่เทค'] || 0;
    });
    
    console.log('Provider'.padEnd(20) + 'OLD (unique)'.padEnd(15) + 'NEW (all records)'.padEnd(20) + 'Difference');
    console.log('──────────────────────────────────────────────────────────');
    Object.keys(oldGrandTotals).forEach(provider => {
      const oldVal = oldGrandTotals[provider];
      const newVal = newGrandTotals[provider];
      const diff = newVal - oldVal;
      console.log(
        provider.padEnd(20) +
        String(oldVal).padEnd(15) +
        String(newVal).padEnd(20) +
        (diff > 0 ? `+${diff}` : diff)
      );
    });
    
    const oldTotal = Object.values(oldGrandTotals).reduce((a, b) => a + b, 0);
    const newTotal = Object.values(newGrandTotals).reduce((a, b) => a + b, 0);
    
    console.log('══════════════════════════════════════════════════════════');
    console.log('Total'.padEnd(20) + String(oldTotal).padEnd(15) + String(newTotal).padEnd(20) + (newTotal - oldTotal > 0 ? `+${newTotal - oldTotal}` : newTotal - oldTotal));
    console.log('══════════════════════════════════════════════════════════');
    
    console.log('\n✅ NEW logic should match the actual workgroup count (1,790)');
    console.log(`   Expected: WW-Provider=1,191, True Tech=573, เถ้าแก่เทค=26, Total=1,790`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWorkgroupAPI();
