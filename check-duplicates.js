const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate national_id...\n');
  
  let allData = [];
  let page = 0;
  
  while (true) {
    const { data } = await supabase
      .from('technicians')
      .select('tech_id, national_id, power_authority')
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  
  console.log(`✅ Fetched ${allData.length} records\n`);
  
  // Count by national_id
  const byNationalId = {};
  allData.forEach(row => {
    const nid = String(row.national_id || '').trim();
    if (!nid || nid === 'null' || nid === 'undefined') return;
    
    if (!byNationalId[nid]) {
      byNationalId[nid] = [];
    }
    byNationalId[nid].push(row);
  });
  
  // Find duplicates
  const duplicates = Object.entries(byNationalId).filter(([nid, rows]) => rows.length > 1);
  
  console.log(`📊 Total unique national_id: ${Object.keys(byNationalId).length}`);
  console.log(`📊 Total records: ${allData.length}`);
  console.log(`📊 Duplicate national_id: ${duplicates.length}\n`);
  
  if (duplicates.length > 0) {
    console.log('⚠️  Sample duplicates (first 5):');
    duplicates.slice(0, 5).forEach(([nid, rows]) => {
      console.log(`\n  National ID: ${nid} (${rows.length} records)`);
      rows.forEach(r => {
        console.log(`    - tech_id: ${r.tech_id}, power_authority: ${r.power_authority}`);
      });
    });
  }
  
  // Count power_authority with duplicates
  let totalYes = 0;
  let totalNo = 0;
  
  allData.forEach(row => {
    const pa = String(row.power_authority || '').trim().toLowerCase();
    if (pa === 'yes' || pa === 'y') totalYes++;
    else if (pa === 'no' || pa === 'n') totalNo++;
  });
  
  console.log('\n📊 Count ALL records (with duplicates):');
  console.log(`Yes: ${totalYes}`);
  console.log(`No: ${totalNo}`);
  console.log(`Sum: ${totalYes + totalNo}`);
  
  // Count unique national_id
  const uniqueYes = new Set();
  const uniqueNo = new Set();
  
  allData.forEach(row => {
    const nid = String(row.national_id || '').trim();
    if (!nid || nid === 'null' || nid === 'undefined') return;
    
    const pa = String(row.power_authority || '').trim().toLowerCase();
    if (pa === 'yes' || pa === 'y') uniqueYes.add(nid);
    else if (pa === 'no' || pa === 'n') uniqueNo.add(nid);
  });
  
  console.log('\n📊 Count UNIQUE national_id:');
  console.log(`Yes: ${uniqueYes.size}`);
  console.log(`No: ${uniqueNo.size}`);
  console.log(`Sum: ${uniqueYes.size + uniqueNo.size}`);
}

checkDuplicates();
