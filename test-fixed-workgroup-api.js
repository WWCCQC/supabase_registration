const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testFixedAPI() {
  console.log('🧪 Testing Fixed Workgroup API...\n');
  
  try {
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
    
    const headsOnly = allData.filter((row) => {
      const status = row.workgroup_status || "";
      return status.startsWith("ห");
    });
    
    // Simulate API logic WITHOUT provider totals
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
    
    // DON'T calculate provider totals (removed!)
    
    console.log('📊 Sample RSM1_BMA-West result:');
    console.log(JSON.stringify(result['RSM1_BMA-West'], null, 2));
    console.log('');
    
    // Test frontend calculation
    let frontendTotal = 0;
    Object.keys(result).forEach(rsm => {
      Object.keys(result[rsm]).forEach(key => {
        if (key.includes('_Installation') || key.includes('_Repair')) {
          frontendTotal += result[rsm][key];
        }
      });
    });
    
    console.log('📊 Results:');
    console.log(`API Grand Total (actual heads): ${headsOnly.length}`);
    console.log(`Frontend calculated total: ${frontendTotal}`);
    console.log(`Difference: ${Math.abs(headsOnly.length - frontendTotal)}`);
    
    if (headsOnly.length === frontendTotal) {
      console.log('\n✅ SUCCESS! No double-counting issue');
    } else {
      console.log('\n❌ FAILED! Still have discrepancy');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFixedAPI();
