// Check records with null/empty Register
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNullRegisters() {
  console.log('🔍 Checking for null/empty Register values...\n');

  // Get all records
  const { data, error } = await supabase
    .from('transaction')
    .select('*')
    .limit(1731);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Count by Register value
  const nullRegisters = data.filter(item => !item.Register || item.Register === '' || item.Register === null);
  const withRegister = data.filter(item => item.Register);

  console.log(`📊 Total records: ${data.length}`);
  console.log(`✅ With Register value: ${withRegister.length}`);
  console.log(`❌ Without Register value (null/empty): ${nullRegisters.length}`);

  console.log('\n' + '='.repeat(80));
  console.log('\n📋 Breakdown of records WITH Register:');
  const registerCounts = {};
  withRegister.forEach(item => {
    registerCounts[item.Register] = (registerCounts[item.Register] || 0) + 1;
  });
  Object.entries(registerCounts).forEach(([key, count]) => {
    console.log(`  "${key}": ${count} records`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n📝 Sample of records WITHOUT Register (first 10):');
  nullRegisters.slice(0, 10).forEach((record, i) => {
    console.log(`\n${i+1}.`);
    console.log(`  Year: ${record.Year}`);
    console.log(`  Month: ${record.Month}`);
    console.log(`  Week: ${record.Week}`);
    console.log(`  Date: ${record.Date}`);
    console.log(`  Register: [${record.Register}]`);
    console.log(`  national_id: ${record.national_id}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 Summary:');
  console.log(`Total = ${data.length}`);
  console.log(`ช่างใหม่ = ${registerCounts['ช่างใหม่'] || 0}`);
  console.log(`ช่างลาออก = ${registerCounts['ช่างลาออก'] || 0}`);
  console.log(`Other/Null = ${nullRegisters.length}`);
  console.log(`Sum = ${(registerCounts['ช่างใหม่'] || 0) + (registerCounts['ช่างลาออก'] || 0) + nullRegisters.length}`);
}

checkNullRegisters();
