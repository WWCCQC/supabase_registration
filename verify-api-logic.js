const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyAPILogic() {
  console.log('🔍 Simulating API logic to verify counts...\n');
  
  // Fetch all data (simulating API)
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data } = await supabase
      .from('technicians')
      .select('rsm, provider, power_authority, national_id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  
  console.log(`✅ Fetched ${allData.length} records\n`);
  
  // Count using unique national_id (exactly like API does)
  const allNationalIds = new Set();
  const allYesNationalIds = new Set();
  const allNoNationalIds = new Set();
  
  allData.forEach((row) => {
    const powerAuthority = String(row.power_authority || "").trim();
    const nationalId = String(row.national_id || "").trim();
    
    if (!nationalId || nationalId === "null" || nationalId === "undefined") return;
    
    allNationalIds.add(nationalId);
    
    if (powerAuthority && powerAuthority !== "null" && powerAuthority !== "undefined") {
      const cleanAuthority = powerAuthority.toLowerCase();
      if (cleanAuthority === "yes" || cleanAuthority === "y") {
        allYesNationalIds.add(nationalId);
      } else if (cleanAuthority === "no" || cleanAuthority === "n") {
        allNoNationalIds.add(nationalId);
      }
    }
  });
  
  console.log('📊 API Logic Results (using unique national_id):');
  console.log('═══════════════════════════════════════');
  console.log(`Total unique national_id: ${allNationalIds.size}`);
  console.log(`Yes: ${allYesNationalIds.size}`);
  console.log(`No: ${allNoNationalIds.size}`);
  console.log(`Sum: ${allYesNationalIds.size + allNoNationalIds.size}`);
  console.log('═══════════════════════════════════════\n');
  
  console.log('✅ Expected values:');
  console.log('Yes: 390');
  console.log('No: 2,545');
  console.log('Total: 2,935');
  console.log('');
  
  if (allYesNationalIds.size === 390 && allNoNationalIds.size === 2545) {
    console.log('✅ SUCCESS! API logic will return correct values.');
  } else {
    console.log('❌ ERROR! Values do not match expected.');
  }
}

verifyAPILogic();
