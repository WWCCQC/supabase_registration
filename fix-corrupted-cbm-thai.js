// Fix corrupted CBM Thai text in Supabase database
// Issues: 
//   "BKK : มีนบุ??ี_คันนายาว_บึงกุ่ม" → "BKK : มีนบุรี_คันนายาว_บึงกุ่ม"
//   "BKK : บางซื่อ_จตุจักร_พญ???ไท_ดินแดง_ห้วยขวาง" → "BKK : บางซื่อ_จตุจักร_พญาไท_ดินแดง_ห้วยขวาง"

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sggunyytungtyhezchft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZ3VueXl0dW5ndHloZXpjaGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQzMjU5MywiZXhwIjoyMDcxMDA4NTkzfQ.NA8WAm2UPi5b1PNk44ZkAkitIxaPkcQ2mg6kcjNCMac'
);

async function scanAndFixCBM() {
  console.log('🔍 Step 1: Scanning ALL CBM values for corrupted Thai text...\n');

  // Get all unique CBM values
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

  console.log(`Total records scanned: ${allData.length}`);

  // Get unique CBM values
  const uniqueCBMs = [...new Set(allData.map(r => r.CBM).filter(Boolean))];
  console.log(`Unique CBM values: ${uniqueCBMs.length}\n`);

  // Show all unique CBM values for reference
  console.log('📋 All unique CBM values:');
  uniqueCBMs.sort().forEach((cbm, i) => {
    const hasFFD = cbm.includes('\uFFFD');
    const count = allData.filter(r => r.CBM === cbm).length;
    console.log(`  ${i + 1}. "${cbm}" (${count} records)${hasFFD ? ' ⚠️ CORRUPTED (U+FFFD)' : ''}`);
  });

  // Find corrupted values (containing U+FFFD or other encoding issues)
  const corruptedCBMs = uniqueCBMs.filter(cbm => {
    if (cbm.includes('\uFFFD')) return true;
    // Check for other potential encoding issues - characters that shouldn't be in Thai/English text
    if (/[\u0080-\u00FF]/.test(cbm)) return true; // Latin-1 supplement chars in Thai text
    return false;
  });

  console.log(`\n❌ Corrupted CBM values: ${corruptedCBMs.length}`);
  corruptedCBMs.forEach(cbm => {
    const count = allData.filter(r => r.CBM === cbm).length;
    // Show hex of each character for debugging
    const hex = [...cbm].map(c => `U+${c.codePointAt(0).toString(16).padStart(4, '0')}`).join(' ');
    console.log(`  "${cbm}" (${count} records)`);
    console.log(`    Hex: ${hex}`);
  });

  // Define corrections mapping
  const corrections = {
    // Pattern: if CBM contains these keywords, map to correct value
  };

  // Build corrections dynamically
  for (const cbm of corruptedCBMs) {
    let correctValue = null;
    
    if (/คันนายาว/.test(cbm) && /บึงกุ่ม/.test(cbm)) {
      correctValue = cbm.replace(/มีนบุ[^\s_]*คันนายาว/, 'มีนบุรี_คันนายาว')
        .replace(/\uFFFD/g, '');
      // Use the known correct value
      if (cbm.includes('BKK')) {
        correctValue = 'BKK : มีนบุรี_คันนายาว_บึงกุ่ม';
      }
    } else if (/จตุจักร/.test(cbm) && /ห้วยขวาง/.test(cbm)) {
      if (cbm.includes('BKK')) {
        correctValue = 'BKK : บางซื่อ_จตุจักร_พญาไท_ดินแดง_ห้วยขวาง';
      }
    } else if (/บางบ่อ/.test(cbm) || /บางเสาธง/.test(cbm) && /บางพลี/.test(cbm)) {
      if (cbm.includes('SMP')) {
        correctValue = 'SMP : บางบ่อ_บางเสาธง_บางพลี';
      }
    } else if (/ธัญบุรี/.test(cbm) && /หนองเสือ/.test(cbm)) {
      if (cbm.includes('PTT')) {
        correctValue = 'PTT : ธัญบุรี_หนองเสือ_ลำลูกกา';
      }
    } else if (/ดกระบัง/.test(cbm) || /หนองจอก/.test(cbm) && /คลองสามวา/.test(cbm)) {
      correctValue = 'ลาดกระบัง_หนองจอก_คลองสามวา';
      if (cbm.includes('BKK')) {
        correctValue = 'BKK : ลาดกระบัง_หนองจอก_คลองสามวา';
      }
    } else if (/พระนคร/.test(cbm) && /ดุสิต/.test(cbm)) {
      if (cbm.includes('BKK')) {
        correctValue = 'BKK : พระนคร_ดุสิต_บางรัก_สาทร_ป้อมปราบศัตรูพ่าย_สัมพันธวงศ์_ยานนาวา_บางคอแหลม';
      }
    }
    
    // Generic fallback: just remove U+FFFD
    if (!correctValue) {
      correctValue = cbm.replace(/\uFFFD/g, '');
    }

    if (correctValue && correctValue !== cbm) {
      corrections[cbm] = correctValue;
    }
  }

  if (Object.keys(corrections).length === 0) {
    console.log('\n✅ No fixable corrupted CBM values found.');
    return;
  }

  console.log('\n🔧 Step 2: Applying corrections...');
  for (const [oldValue, newValue] of Object.entries(corrections)) {
    const records = allData.filter(r => r.CBM === oldValue);
    console.log(`\n  Fixing: "${oldValue}" → "${newValue}" (${records.length} records)`);

    // Update in batches
    for (const record of records) {
      const { data, error } = await supabase
        .from('technicians')
        .update({ CBM: newValue })
        .eq('national_id', record.national_id)
        .eq('CBM', oldValue)
        .select('national_id, CBM');

      if (error) {
        console.log(`    ❌ Error updating ${record.national_id}: ${error.message}`);
      } else {
        console.log(`    ✅ Updated ${record.national_id}`);
      }
    }
  }

  // Step 3: Verify
  console.log('\n🔍 Step 3: Verification...');
  let verifyData = [];
  from = 0;
  hasMore = true;

  while (hasMore) {
    const { data: page } = await supabase
      .from('technicians')
      .select('CBM')
      .range(from, from + pageSize - 1);

    if (page && page.length > 0) {
      verifyData.push(...page);
      from += pageSize;
      hasMore = page.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  const stillCorrupted = verifyData.filter(r => r.CBM && r.CBM.includes('\uFFFD'));
  if (stillCorrupted.length === 0) {
    console.log('✅ All corrupted CBM values have been fixed!');
  } else {
    const uniqueStill = [...new Set(stillCorrupted.map(r => r.CBM))];
    console.log(`⚠️ Still ${stillCorrupted.length} corrupted records (${uniqueStill.length} unique values):`);
    uniqueStill.forEach(cbm => console.log(`  "${cbm}"`));
  }
}

scanAndFixCBM().catch(console.error);
