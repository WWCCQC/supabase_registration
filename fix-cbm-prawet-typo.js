const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://sggunyytungtyhezchft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZ3VueXl0dW5ndHloZXpjaGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQzMjU5MywiZXhwIjoyMDcxMDA4NTkzfQ.NA8WAm2UPi5b1PNk44ZkAkitIxaPkcQ2mg6kcjNCMac'
);

async function fixCBM() {
  const correctValue = 'BKK : ประเวศ_บางกะปิ_สะพานสูง';

  // Find all records with corrupted CBM containing U+FFFD
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: page } = await supabase
      .from('technicians')
      .select('id, CBM, national_id')
      .range(from, from + pageSize - 1);

    if (page && page.length > 0) {
      allData.push(...page);
      from += pageSize;
      hasMore = page.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // Find records with corrupted CBM containing U+FFFD AND บางกะปิ_สะพานสูง
  const corrupted = allData.filter(r => {
    if (!r.CBM) return false;
    return r.CBM.includes('\uFFFD') && r.CBM.includes('บางกะปิ') && r.CBM.includes('สะพานสูง');
  });

  console.log(`Found ${corrupted.length} corrupted records to fix:`);
  corrupted.forEach(r => {
    console.log(`  id=${r.id}, CBM="${r.CBM}", national_id=${r.national_id}`);
  });

  if (corrupted.length === 0) {
    console.log('No corrupted records found. Nothing to fix.');
    return;
  }

  // Fix each corrupted record
  for (const record of corrupted) {
    const { error } = await supabase
      .from('technicians')
      .update({ CBM: correctValue })
      .eq('id', record.id);

    if (error) {
      console.log(`  ERROR fixing id=${record.id}:`, error);
    } else {
      console.log(`  FIXED id=${record.id}: "${record.CBM}" -> "${correctValue}"`);
    }
  }

  console.log('\nDone! Fixed all corrupted records.');
}

fixCBM();
