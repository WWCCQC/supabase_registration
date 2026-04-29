/**
 * ตรวจสอบข้อมูลที่มี national_id ซ้ำกัน
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDuplicateNationalId() {
  console.log('🔍 ตรวจสอบข้อมูลที่มี national_id ซ้ำกัน...\n');

  // ดึงข้อมูลทั้งหมด
  let allData = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('technicians')
      .select('tech_id, national_id, full_name')
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`📊 จำนวนข้อมูลทั้งหมด: ${allData.length} รายการ\n`);

  // หา national_id ที่ซ้ำกัน
  const nationalIdMap = new Map();
  allData.forEach(row => {
    const nationalId = row.national_id;
    if (nationalIdMap.has(nationalId)) {
      nationalIdMap.get(nationalId).push(row);
    } else {
      nationalIdMap.set(nationalId, [row]);
    }
  });

  // หา national_id ที่ปรากฏมากกว่า 1 ครั้ง
  const duplicates = Array.from(nationalIdMap.entries())
    .filter(([_, rows]) => rows.length > 1);
  
  const uniqueNationalIds = nationalIdMap.size;
  const totalRows = allData.length;
  const duplicateRows = totalRows - uniqueNationalIds;

  console.log(`📊 จำนวน national_id ที่ไม่ซ้ำกัน: ${uniqueNationalIds}`);
  console.log(`📊 จำนวนรายการที่ซ้ำ: ${duplicateRows} รายการ\n`);

  if (duplicates.length > 0) {
    console.log(`⚠️  พบ national_id ที่ซ้ำกัน: ${duplicates.length} รายการ\n`);
    
    // แสดงข้อมูลที่ซ้ำกัน
    duplicates.forEach(([nationalId, rows]) => {
      console.log(`\n📋 National ID: ${nationalId} (ปรากฏ ${rows.length} ครั้ง)`);
      rows.forEach((row, idx) => {
        console.log(`   ${idx + 1}. tech_id: ${row.tech_id} - ${row.full_name}`);
      });
    });
    
    console.log(`\n✅ นี่คือสาเหตุที่ API แสดง ${uniqueNationalIds} แทนที่จะเป็น ${totalRows}!`);
    console.log(`   API กำลังนับแบบ unique national_id ซึ่งทำให้ข้อมูลที่ซ้ำกันถูกนับเป็น 1`);
  } else {
    console.log('✅ ไม่พบ national_id ที่ซ้ำกัน');
  }
}

checkDuplicateNationalId();
