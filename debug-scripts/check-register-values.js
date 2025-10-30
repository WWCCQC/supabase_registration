// Check all unique Register values from Transaction table
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRegisterValues() {
  console.log('🔍 Checking Register column values from Transaction table...\n');

  // Get all records
  const { data, error, count } = await supabase
    .from('transaction')
    .select('Register', { count: 'exact' });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total records: ${count}`);
  console.log('='.repeat(80));

  // Get unique Register values
  const uniqueRegisters = [...new Set(data.map(item => item.Register).filter(Boolean))];
  console.log(`\n📋 Unique Register values (${uniqueRegisters.length} types):`);
  uniqueRegisters.forEach(val => {
    console.log(`  - "${val}"`);
  });

  // Count each type
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Count by Register type:');
  const counts = {};
  data.forEach(item => {
    const register = item.Register || '(null)';
    counts[register] = (counts[register] || 0) + 1;
  });

  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log(`  ${key}: ${count} records`);
  });

  // Search for variations
  console.log('\n' + '='.repeat(80));
  console.log('\n🔎 Checking for variations:');
  
  const newTechVariations = data.filter(item => 
    item.Register && item.Register.includes('ช่างใหม่')
  );
  console.log(`\n"ช่างใหม่" (any variation): ${newTechVariations.length} records`);
  
  const resignedVariations = data.filter(item => 
    item.Register && item.Register.includes('ช่างลาออก')
  );
  console.log(`"ช่างลาออก" (any variation): ${resignedVariations.length} records`);

  // Show samples
  console.log('\n' + '='.repeat(80));
  console.log('\n📝 Sample records (first 10):');
  data.slice(0, 10).forEach((record, i) => {
    console.log(`  ${i+1}. "${record.Register}"`);
  });

  // Check for trimming issues
  console.log('\n' + '='.repeat(80));
  console.log('\n⚠️  Checking for whitespace issues:');
  const hasWhitespace = data.filter(item => {
    if (!item.Register) return false;
    return item.Register !== item.Register.trim();
  });
  console.log(`Records with leading/trailing whitespace: ${hasWhitespace.length}`);
  if (hasWhitespace.length > 0) {
    console.log('Examples:');
    hasWhitespace.slice(0, 5).forEach(item => {
      console.log(`  - [${item.Register}] (length: ${item.Register.length})`);
    });
  }
}

checkRegisterValues();
