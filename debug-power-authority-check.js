/**
 * ตรวจสอบข้อมูล power_authority จริงจาก Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPowerAuthority() {
  console.log('🔍 ตรวจสอบข้อมูล power_authority...\n');

  // 1. นับจำนวนทั้งหมด
  const { count: totalCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 จำนวนข้อมูลทั้งหมด: ${totalCount} รายการ\n`);

  // 2. ดึงข้อมูล power_authority ทั้งหมด
  let allData = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('technicians')
      .select('power_authority, national_id, tech_id, full_name, rsm')
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    console.log(`   ดึงข้อมูล batch: ${data.length} รายการ, รวม: ${allData.length}`);
    
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`\n✅ ดึงข้อมูลทั้งหมด: ${allData.length} รายการ\n`);

  // 3. นับค่า power_authority
  console.log('📊 === การกระจายของ power_authority ===');
  const powerCount = {};
  allData.forEach(row => {
    const power = row.power_authority || 'NULL';
    powerCount[power] = (powerCount[power] || 0) + 1;
  });

  Object.entries(powerCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([power, count]) => {
      const percent = ((count / totalCount) * 100).toFixed(2);
      console.log(`  "${power}": ${count} รายการ (${percent}%)`);
    });
  console.log('');

  // 4. นับแบบ case-insensitive
  console.log('📊 === นับแบบ case-insensitive ===');
  let yesCount = 0;
  let noCount = 0;
  let otherCount = 0;
  const otherValues = [];

  allData.forEach(row => {
    const power = (row.power_authority || '').toString().toLowerCase().trim();
    
    if (power === 'yes' || power === 'y') {
      yesCount++;
    } else if (power === 'no' || power === 'n') {
      noCount++;
    } else {
      otherCount++;
      if (otherValues.length < 10) {
        otherValues.push(row.power_authority);
      }
    }
  });

  console.log(`  Yes: ${yesCount} รายการ`);
  console.log(`  No: ${noCount} รายการ`);
  console.log(`  Other/NULL: ${otherCount} รายการ`);
  console.log(`  รวม: ${yesCount + noCount + otherCount}`);
  
  if (otherValues.length > 0) {
    console.log(`\n  ตัวอย่างค่า Other/NULL:`, otherValues);
  }
  console.log('');

  // 5. ตรวจสอบข้อมูลที่มี RSM (สำหรับกราฟ)
  console.log('📊 === ข้อมูลที่มี RSM (สำหรับกราฟ) ===');
  const withRsm = allData.filter(row => row.rsm && row.rsm.trim() !== '');
  console.log(`จำนวนรายการที่มี RSM: ${withRsm.length}`);

  let yesWithRsm = 0;
  let noWithRsm = 0;
  let otherWithRsm = 0;

  withRsm.forEach(row => {
    const power = (row.power_authority || '').toString().toLowerCase().trim();
    
    if (power === 'yes' || power === 'y') {
      yesWithRsm++;
    } else if (power === 'no' || power === 'n') {
      noWithRsm++;
    } else {
      otherWithRsm++;
    }
  });

  console.log(`  Yes (มี RSM): ${yesWithRsm} รายการ`);
  console.log(`  No (มี RSM): ${noWithRsm} รายการ`);
  console.log(`  Other/NULL (มี RSM): ${otherWithRsm} รายการ`);
  console.log(`  รวม: ${yesWithRsm + noWithRsm + otherWithRsm}`);
  console.log('');

  // 6. นับแบบ unique national_id
  console.log('📊 === นับแบบ unique national_id ===');
  const uniqueYes = new Set();
  const uniqueNo = new Set();
  
  allData.forEach(row => {
    const power = (row.power_authority || '').toString().toLowerCase().trim();
    const nationalId = row.national_id || row.tech_id || '';
    
    if (!nationalId || nationalId === 'null' || nationalId === 'undefined') return;
    
    if (power === 'yes' || power === 'y') {
      uniqueYes.add(nationalId);
    } else if (power === 'no' || power === 'n') {
      uniqueNo.add(nationalId);
    }
  });

  console.log(`  Unique Yes: ${uniqueYes.size} รายการ`);
  console.log(`  Unique No: ${uniqueNo.size} รายการ`);
  console.log(`  รวม: ${uniqueYes.size + uniqueNo.size}`);
  console.log('');

  // 7. เปรียบเทียบกับกราฟ
  console.log('📊 === เปรียบเทียบกับกราฟ ===');
  console.log('ตามภาพที่แนบ:');
  console.log('  No: 2,536 รายการ');
  console.log('  Yes: 400 รายการ');
  console.log('  รวม: 2,936 รายการ');
  console.log('');
  console.log('จากฐานข้อมูลจริง (ทั้งหมด):');
  console.log(`  No: ${noCount} รายการ`);
  console.log(`  Yes: ${yesCount} รายการ`);
  console.log(`  รวม: ${yesCount + noCount}`);
  console.log('');
  
  if (yesCount !== 400 || noCount !== 2536) {
    console.log('❌ ข้อมูลไม่ตรงกัน!');
    console.log(`  Yes ต่างกัน: ${400 - yesCount}`);
    console.log(`  No ต่างกัน: ${2536 - noCount}`);
  } else {
    console.log('✅ ข้อมูลตรงกัน');
  }
}

checkPowerAuthority();
