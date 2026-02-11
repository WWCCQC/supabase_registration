// Fix corrupted CBM value in Supabase database
// Issue: "SMP : ��างบ่อ_บางเสาธง_บางพลี" has U+FFFD replacement characters
// Should be: "SMP : บางบ่อ_บางเสาธง_บางพลี"

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sggunyytungtyhezchft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZ3VueXl0dW5ndHloZXpjaGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQzMjU5MywiZXhwIjoyMDcxMDA4NTkzfQ.NA8WAm2UPi5b1PNk44ZkAkitIxaPkcQ2mg6kcjNCMac'
);

async function fixCorruptedCBM() {
  console.log('🔍 Searching for corrupted CBM values...\n');

  // Find all records with SMP + บางพลี
  const { data: allSMP } = await supabase
    .from('technicians')
    .select('CBM, national_id')
    .like('CBM', '%SMP%บางพลี%');

  if (!allSMP) {
    console.log('No data found');
    return;
  }

  // Find corrupted records (CBM containing U+FFFD)
  const corrupted = allSMP.filter(r => r.CBM && r.CBM.includes('\uFFFD'));
  const correct = allSMP.filter(r => r.CBM && !r.CBM.includes('\uFFFD'));

  console.log(`✅ Correct CBM records: ${correct.length}`);
  console.log(`❌ Corrupted CBM records: ${corrupted.length}`);

  if (corrupted.length === 0) {
    console.log('\n✅ No corrupted records found! Already fixed.');
    return;
  }

  console.log('\nCorrupted records:');
  corrupted.forEach(r => {
    console.log(`  national_id: ${r.national_id}, CBM: "${r.CBM}"`);
  });

  const correctValue = 'SMP : บางบ่อ_บางเสาธง_บางพลี';
  console.log(`\n🔧 Fixing to: "${correctValue}"`);

  // Update each corrupted record by national_id
  for (const record of corrupted) {
    const { data, error } = await supabase
      .from('technicians')
      .update({ CBM: correctValue })
      .eq('national_id', record.national_id)
      .eq('CBM', record.CBM)
      .select('national_id, CBM');

    if (error) {
      console.log(`  ❌ Error updating ${record.national_id}:`, error.message);
    } else {
      console.log(`  ✅ Updated ${record.national_id} -> "${data[0]?.CBM}"`);
    }
  }

  // Verify
  console.log('\n🔍 Verification...');
  const { data: verify } = await supabase
    .from('technicians')
    .select('CBM')
    .like('CBM', '%SMP%บางพลี%');

  const stillCorrupted = verify?.filter(r => r.CBM?.includes('\uFFFD')) || [];
  console.log(`Remaining corrupted: ${stillCorrupted.length}`);
  
  if (stillCorrupted.length === 0) {
    console.log('✅ All corrupted CBM values have been fixed!');
  }

  // Also check for any other corrupted CBM values in the entire table
  console.log('\n🔍 Scanning ALL CBM values for U+FFFD...');
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: page } = await supabase
      .from('technicians')
      .select('CBM, national_id')
      .range(from, from + pageSize - 1);

    if (page && page.length > 0) {
      allData.push(...page);
      from += pageSize;
      hasMore = page.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  const otherCorrupted = allData.filter(r => r.CBM && r.CBM.includes('\uFFFD'));
  if (otherCorrupted.length > 0) {
    console.log(`\n⚠️ Found ${otherCorrupted.length} other corrupted CBM records:`);
    const uniqueCorrupted = [...new Set(otherCorrupted.map(r => r.CBM))];
    uniqueCorrupted.forEach(cbm => {
      const count = otherCorrupted.filter(r => r.CBM === cbm).length;
      console.log(`  "${cbm}" (${count} records)`);
    });
  } else {
    console.log('✅ No other corrupted CBM values found in the entire database!');
  }
}

fixCorruptedCBM().catch(console.error);
