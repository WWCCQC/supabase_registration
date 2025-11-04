const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyPowerAuthority() {
  console.log('🔍 Verifying Power Authority Status from Supabase...\n');
  
  try {
    // Fetch all technicians
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('power_authority, rsm')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      page++;
    }
    
    console.log(`✅ Total records fetched: ${allData.length}\n`);
    
    // Count by status
    let yesCount = 0;
    let noCount = 0;
    let nullCount = 0;
    let otherCount = 0;
    const otherValues = new Set();
    
    allData.forEach(row => {
      const status = row.power_authority;
      if (status === 'Yes' || status === 'yes' || status === 'YES') {
        yesCount++;
      } else if (status === 'No' || status === 'no' || status === 'NO') {
        noCount++;
      } else if (!status || status === null) {
        nullCount++;
      } else {
        otherCount++;
        otherValues.add(status);
      }
    });
    
    console.log('📊 Power Authority Status Count:');
    console.log('═══════════════════════════════════════');
    console.log(`Yes: ${yesCount}`);
    console.log(`No: ${noCount}`);
    console.log(`Null/Empty: ${nullCount}`);
    if (otherCount > 0) {
      console.log(`Other values: ${otherCount}`);
      console.log(`Other values list: ${Array.from(otherValues).join(', ')}`);
    }
    console.log('═══════════════════════════════════════');
    console.log(`Total: ${yesCount + noCount + nullCount + otherCount}`);
    console.log('');
    
    // Count by RSM
    const byRSM = {};
    
    allData.forEach(row => {
      const rsm = row.rsm || 'Unknown';
      const status = row.power_authority;
      
      if (!byRSM[rsm]) {
        byRSM[rsm] = { Yes: 0, No: 0, Null: 0, Other: 0 };
      }
      
      if (status === 'Yes' || status === 'yes' || status === 'YES') {
        byRSM[rsm].Yes++;
      } else if (status === 'No' || status === 'no' || status === 'NO') {
        byRSM[rsm].No++;
      } else if (!status || status === null) {
        byRSM[rsm].Null++;
      } else {
        byRSM[rsm].Other++;
      }
    });
    
    console.log('📊 Power Authority by RSM:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('RSM'.padEnd(25) + 'Yes'.padStart(8) + 'No'.padStart(8) + 'Null'.padStart(8) + 'Total'.padStart(10));
    console.log('───────────────────────────────────────────────────────────');
    
    const rsms = Object.keys(byRSM).sort();
    rsms.forEach(rsm => {
      const data = byRSM[rsm];
      const total = data.Yes + data.No + data.Null + data.Other;
      console.log(
        rsm.padEnd(25) +
        String(data.Yes).padStart(8) +
        String(data.No).padStart(8) +
        String(data.Null).padStart(8) +
        String(total).padStart(10)
      );
    });
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Direct DB count for verification
    const { count: yesCountDB, error: yesError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('power_authority', 'Yes');
    
    const { count: noCountDB, error: noError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('power_authority', 'No');
    
    console.log('✅ Direct DB Count (exact):');
    console.log(`Yes: ${yesCountDB}`);
    console.log(`No: ${noCountDB}`);
    console.log(`Total: ${yesCountDB + noCountDB}`);
    console.log('');
    
    console.log('⚠️  Comparison:');
    console.log(`Fetched Yes: ${yesCount} vs DB Yes: ${yesCountDB} (diff: ${yesCount - yesCountDB})`);
    console.log(`Fetched No: ${noCount} vs DB No: ${noCountDB} (diff: ${noCount - noCountDB})`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyPowerAuthority();
