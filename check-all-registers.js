// Check ALL records with batch fetching
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllRegisters() {
  console.log('🔍 Fetching ALL transaction records...\n');

  // Get total count first
  const { count } = await supabase
    .from('transaction')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total records in database: ${count}`);

  // Fetch in batches
  let allData = [];
  const batchSize = 1000;
  let page = 0;

  while (page * batchSize < count) {
    const from = page * batchSize;
    const to = from + batchSize - 1;

    const { data, error } = await supabase
      .from('transaction')
      .select('Year, Month, Week, Date, Register, national_id')
      .range(from, to);

    if (error) {
      console.error('Error:', error);
      break;
    }

    allData = [...allData, ...data];
    console.log(`Fetched batch ${page + 1}: ${data.length} records (total: ${allData.length})`);
    page++;
  }

  console.log(`\n✅ Loaded ${allData.length} records`);
  console.log('='.repeat(80));

  // Analyze Register values
  const registerCounts = {};
  let nullCount = 0;

  allData.forEach(item => {
    if (!item.Register || item.Register === '' || item.Register === null) {
      nullCount++;
    } else {
      registerCounts[item.Register] = (registerCounts[item.Register] || 0) + 1;
    }
  });

  console.log('\n📋 Register value counts:');
  Object.entries(registerCounts).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log(`  "${key}": ${count} records`);
  });
  console.log(`  [NULL/EMPTY]: ${nullCount} records`);

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 Summary:');
  console.log(`Total records: ${allData.length}`);
  console.log(`ช่างใหม่: ${registerCounts['ช่างใหม่'] || 0}`);
  console.log(`ช่างลาออก: ${registerCounts['ช่างลาออก'] || 0}`);
  console.log(`Corrupted (��่างใหม่): ${registerCounts['��่างใหม่'] || 0}`);
  console.log(`NULL/Empty: ${nullCount}`);
  console.log(`Total accounted: ${(registerCounts['ช่างใหม่'] || 0) + (registerCounts['ช่างลาออก'] || 0) + (registerCounts['��่างใหม่'] || 0) + nullCount}`);

  // Show sample of null records
  if (nullCount > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 Sample NULL Register records (first 5):');
    const nullRecords = allData.filter(item => !item.Register || item.Register === '');
    nullRecords.slice(0, 5).forEach((record, i) => {
      console.log(`\n${i+1}. Year: ${record.Year}, Month: ${record.Month}, Week: ${record.Week}, Date: ${record.Date}`);
    });
  }
}

checkAllRegisters();
