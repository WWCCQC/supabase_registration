const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testTechnicianCount() {
  console.log('🧪 Testing Technician Count API logic...\n');
  
  try {
    // Fetch all technicians
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type, national_id')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      page++;
    }
    
    console.log(`✅ Total records fetched: ${allData.length}\n`);
    
    // Test OLD logic (unique national_id)
    const oldResult = {};
    allData.forEach((row) => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      const nationalId = row.national_id;
      
      if (!nationalId || !rsm || !provider || !workType) return;
      
      if (!oldResult[rsm]) oldResult[rsm] = {};
      
      const key = `${provider}_${workType}`;
      if (!oldResult[rsm][key]) oldResult[rsm][key] = new Set();
      oldResult[rsm][key].add(nationalId);
      
      if (!oldResult[rsm][provider]) oldResult[rsm][provider] = new Set();
      oldResult[rsm][provider].add(nationalId);
    });
    
    // Convert to counts
    const oldCounts = {};
    Object.keys(oldResult).forEach(rsm => {
      oldCounts[rsm] = {};
      Object.keys(oldResult[rsm]).forEach(key => {
        oldCounts[rsm][key] = oldResult[rsm][key].size;
      });
    });
    
    // Test NEW logic (count all records)
    const newResult = {};
    allData.forEach((row) => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      
      if (!rsm || !provider || !workType) return;
      
      if (!newResult[rsm]) newResult[rsm] = {};
      
      const key = `${provider}_${workType}`;
      if (!newResult[rsm][key]) newResult[rsm][key] = 0;
      newResult[rsm][key]++;
      
      if (!newResult[rsm][provider]) newResult[rsm][provider] = 0;
      newResult[rsm][provider]++;
    });
    
    // Compare results
    console.log('📊 Comparison for RSM1_BMA-West:');
    console.log('══════════════════════════════════════════════════════════');
    console.log('Provider_WorkType'.padEnd(30) + 'OLD (unique)'.padEnd(15) + 'NEW (all records)'.padEnd(20) + 'Difference');
    console.log('══════════════════════════════════════════════════════════');
    
    const rsm = 'RSM1_BMA-West';
    const keys = Array.from(new Set([
      ...Object.keys(oldCounts[rsm] || {}),
      ...Object.keys(newResult[rsm] || {})
    ])).sort();
    
    keys.forEach(key => {
      const oldVal = oldCounts[rsm]?.[key] || 0;
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
    console.log('\n📊 Grand Totals Comparison:');
    console.log('══════════════════════════════════════════════════════════');
    
    const oldGrandTotals = { 'WW-Provider': 0, 'True Tech': 0, 'เถ้าแก่เทค': 0 };
    const newGrandTotals = { 'WW-Provider': 0, 'True Tech': 0, 'เถ้าแก่เทค': 0 };
    
    Object.keys(oldCounts).forEach(rsm => {
      oldGrandTotals['WW-Provider'] += oldCounts[rsm]['WW-Provider'] || 0;
      oldGrandTotals['True Tech'] += oldCounts[rsm]['True Tech'] || 0;
      oldGrandTotals['เถ้าแก่เทค'] += oldCounts[rsm]['เถ้าแก่เทค'] || 0;
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
    
    console.log('\n✅ NEW logic should match the actual Supabase count (2,938)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTechnicianCount();
