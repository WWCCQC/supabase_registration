const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://sggunyytungtyhezchft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZ3VueXl0dW5ndHloZXpjaGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQzMjU5MywiZXhwIjoyMDcxMDA4NTkzfQ.NA8WAm2UPi5b1PNk44ZkAkitIxaPkcQ2mg6kcjNCMac'
);

async function findCorrupted() {
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

  console.log(`Total records: ${allData.length}`);

  // Find all records with U+FFFD in CBM
  const withFFD = allData.filter(r => r.CBM && r.CBM.includes('\uFFFD'));
  console.log(`\nRecords with U+FFFD in CBM: ${withFFD.length}`);
  withFFD.forEach(r => {
    const hex = [...r.CBM].map(c => {
      const code = c.charCodeAt(0);
      return code === 0xFFFD ? '<<<FFFD>>>' : c;
    }).join('');
    console.log(`  id=${r.id}, CBM="${hex}", national_id=${r.national_id}`);
  });

  // Find records with เวศ AND บางกะปิ
  const withPrawet = allData.filter(r => r.CBM && r.CBM.includes('เวศ') && r.CBM.includes('บางกะปิ'));
  console.log(`\nRecords with เวศ AND บางกะปิ: ${withPrawet.length}`);
  const uniqueVals = [...new Set(withPrawet.map(r => r.CBM))];
  uniqueVals.forEach(v => {
    const count = withPrawet.filter(r => r.CBM === v).length;
    const hasFFD = v.includes('\uFFFD');
    console.log(`  "${v}" (${count} records) ${hasFFD ? 'HAS U+FFFD' : 'OK'}`);
  });

  // Also find ALL unique CBM values starting with BKK
  const bkkCBMs = [...new Set(allData.filter(r => r.CBM && r.CBM.startsWith('BKK')).map(r => r.CBM))].sort();
  console.log(`\nAll unique CBM values starting with BKK:`);
  bkkCBMs.forEach(v => {
    const count = allData.filter(r => r.CBM === v).length;
    const hasFFD = v.includes('\uFFFD');
    console.log(`  "${v}" (${count} records) ${hasFFD ? '⚠️ HAS U+FFFD' : ''}`);
  });
}

findCorrupted();
