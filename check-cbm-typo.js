const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://sggunyytungtyhezchft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZ3VueXl0dW5ndHloZXpjaGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQzMjU5MywiZXhwIjoyMDcxMDA4NTkzfQ.NA8WAm2UPi5b1PNk44ZkAkitIxaPkcQ2mg6kcjNCMac'
);

async function check() {
  // Find all CBM values containing บางกะปิ and สะพานสูง
  const { data, error } = await supabase
    .from('technicians')
    .select('CBM, national_id')
    .ilike('CBM', '%บางกะปิ%สะพานสูง%');

  if (error) {
    console.log('Error:', error);
    return;
  }

  const unique = [...new Set(data.map(r => r.CBM))];
  console.log('Unique CBM values with บางกะปิ + สะพานสูง:');
  unique.forEach(v => {
    const count = data.filter(r => r.CBM === v).length;
    console.log(`  "${v}" (${count} records)`);
    // Show character codes
    const chars = [...v].map(c => `${c}(${c.charCodeAt(0).toString(16)})`).join(' ');
    console.log(`  Chars: ${chars}`);
  });

  // Also check for ปรเวศ (typo) vs ประเวศ (correct) anywhere
  console.log('\n--- Checking for ปรเวศ (typo without สระอะ) ---');
  const { data: typo } = await supabase
    .from('technicians')
    .select('CBM')
    .ilike('CBM', '%ปรเวศ%');

  if (typo && typo.length > 0) {
    const uniqueTypo = [...new Set(typo.map(r => r.CBM))];
    console.log(`Found ${typo.length} records with ปรเวศ:`);
    uniqueTypo.forEach(v => {
      const count = typo.filter(r => r.CBM === v).length;
      console.log(`  "${v}" (${count} records)`);
    });
  } else {
    console.log('No records found with ปรเวศ typo');
  }

  // Check for ประเวศ (correct) 
  console.log('\n--- Checking for ประเวศ (correct) ---');
  const { data: correct } = await supabase
    .from('technicians')
    .select('CBM')
    .ilike('CBM', '%ประเวศ%');

  if (correct && correct.length > 0) {
    const uniqueCorrect = [...new Set(correct.map(r => r.CBM))];
    console.log(`Found ${correct.length} records with ประเวศ:`);
    uniqueCorrect.forEach(v => {
      const count = correct.filter(r => r.CBM === v).length;
      console.log(`  "${v}" (${count} records)`);
    });
  } else {
    console.log('No records found with ประเวศ');
  }
}

check();
