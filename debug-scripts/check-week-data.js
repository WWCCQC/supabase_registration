// Check Week column data format from Transaction table
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWeekData() {
  console.log('🔍 Checking Week column data from Transaction table...\n');

  // Get first 10 records
  const { data, error } = await supabase
    .from('transaction')
    .select('Year, Month, Week, Date, Register')
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📊 Sample Transaction Records:');
  console.log('='.repeat(80));
  data.forEach((record, index) => {
    console.log(`\nRecord ${index + 1}:`);
    console.log(`  Year: ${record.Year} (type: ${typeof record.Year})`);
    console.log(`  Month: ${record.Month} (type: ${typeof record.Month})`);
    console.log(`  Week: ${record.Week} (type: ${typeof record.Week})`);
    console.log(`  Date: ${record.Date} (type: ${typeof record.Date})`);
    console.log(`  Register: ${record.Register}`);
  });

  // Get unique Week values
  const { data: allData, error: error2 } = await supabase
    .from('transaction')
    .select('Week');

  if (error2) {
    console.error('❌ Error getting all weeks:', error2);
    return;
  }

  const uniqueWeeks = [...new Set(allData.map(item => item.Week).filter(Boolean))];
  console.log('\n' + '='.repeat(80));
  console.log(`\n📋 Unique Week values (${uniqueWeeks.length} total):`);
  console.log(uniqueWeeks.sort((a, b) => Number(a) - Number(b)));

  // Check for any null or undefined weeks
  const nullWeeks = allData.filter(item => !item.Week);
  console.log(`\n⚠️  Records with null/empty Week: ${nullWeeks.length}`);
}

checkWeekData();
