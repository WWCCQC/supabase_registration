const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://sggunyytungtyhezchft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZ3VueXl0dW5ndHloZXpjaGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQzMjU5MywiZXhwIjoyMDcxMDA4NTkzfQ.NA8WAm2UPi5b1PNk44ZkAkitIxaPkcQ2mg6kcjNCMac'
);

async function fixCBM() {
  const correctValue = 'BKK : ประเวศ_บางกะปิ_สะพานสูง';

  // Find corrupted records directly 
  // The corrupted value has U+FFFD between ปร and เวศ
  // Use ilike to find all records with เวศ AND บางกะปิ AND สะพานสูง
  const { data, error } = await supabase
    .from('technicians')
    .select('national_id, CBM')
    .ilike('CBM', '%เวศ%บางกะปิ%สะพานสูง%');

  if (error) {
    console.log('Query Error:', error);
    return;
  }

  console.log(`Found ${data.length} records matching เวศ+บางกะปิ+สะพานสูง`);

  // Filter to find corrupted ones (not matching the correct value)
  const corrupted = data.filter(r => r.CBM !== correctValue);
  console.log(`Corrupted records: ${corrupted.length}`);

  corrupted.forEach(r => {
    const hasFFD = r.CBM.includes('\uFFFD');
    console.log(`  national_id=${r.national_id}, CBM="${r.CBM}" ${hasFFD ? '⚠️ HAS U+FFFD' : ''}`);
    // Show hex chars for debugging
    const hexView = [...r.CBM].map(c => {
      const code = c.charCodeAt(0);
      if (code === 0xFFFD) return '[FFFD]';
      return c;
    }).join('');
    console.log(`  Visual: ${hexView}`);
  });

  if (corrupted.length === 0) {
    console.log('No corrupted records. All already correct!');
    return;
  }

  // Fix corrupted records
  console.log(`\nFixing ${corrupted.length} corrupted records...`);
  for (const record of corrupted) {
    const { error: updateErr } = await supabase
      .from('technicians')
      .update({ CBM: correctValue })
      .eq('national_id', record.national_id)
      .eq('CBM', record.CBM);

    if (updateErr) {
      console.log(`  ERROR fixing national_id=${record.national_id}:`, updateErr);
    } else {
      console.log(`  FIXED national_id=${record.national_id}`);
    }
  }

  // Verify fix
  const { data: verify } = await supabase
    .from('technicians')
    .select('CBM')
    .ilike('CBM', '%เวศ%บางกะปิ%สะพานสูง%');
  
  const uniqueAfter = [...new Set(verify.map(r => r.CBM))];
  console.log('\nAfter fix - unique CBM values:');
  uniqueAfter.forEach(v => {
    const count = verify.filter(r => r.CBM === v).length;
    console.log(`  "${v}" (${count} records)`);
  });
}

fixCBM();
