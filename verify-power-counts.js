// ตรวจสอบ Power Authority counts โดยดึงข้อมูลมาและนับเอง
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getPowerAuthorityCounts() {
  console.log('🔍 กำลังดึงข้อมูลจาก Supabase...\n');

  // Get all data with pagination (same as API)
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('technicians')
      .select('national_id, power_authority, rsm, provider, work_type')
      .order('tech_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`📊 ดึงข้อมูลได้ทั้งหมด: ${allData.length} records`);

  // Count unique national_ids by power_authority
  const yesIds = new Set();
  const noIds = new Set();
  const otherIds = new Set();
  const nullIds = new Set();

  allData.forEach(row => {
    const nationalId = String(row.national_id || '').trim();
    const powerAuth = String(row.power_authority || '').trim().toLowerCase();

    if (!nationalId || nationalId === 'null' || nationalId === 'undefined') {
      return;
    }

    if (!powerAuth || powerAuth === 'null' || powerAuth === 'undefined') {
      nullIds.add(nationalId);
    } else if (powerAuth === 'yes' || powerAuth === 'y') {
      yesIds.add(nationalId);
    } else if (powerAuth === 'no' || powerAuth === 'n') {
      noIds.add(nationalId);
    } else {
      otherIds.add(nationalId);
      console.log(`⚠️  พบค่า power_authority ที่แปลก: "${row.power_authority}"`);
    }
  });

  console.log('\n📊 จำนวนข้อมูล (unique national_id):');
  console.log(`  - Yes: ${yesIds.size} คน`);
  console.log(`  - No: ${noIds.size} คน`);
  console.log(`  - Other: ${otherIds.size} คน`);
  console.log(`  - Null/Empty: ${nullIds.size} คน`);
  console.log(`  - Total: ${yesIds.size + noIds.size + otherIds.size + nullIds.size}`);

  console.log('\n📊 เปรียบเทียบกับหน้าเว็บ:');
  console.log(`  หน้าเว็บแสดง: Yes: 400, No: 2,536 (Total: 2,936)`);
  console.log(`  Database มี: Yes: ${yesIds.size}, No: ${noIds.size} (Total: ${yesIds.size + noIds.size})`);
  
  const yesDiff = 400 - yesIds.size;
  const noDiff = 2536 - noIds.size;
  
  console.log('\n📊 ความแตกต่าง:');
  console.log(`  - Yes: ${yesDiff > 0 ? '+' : ''}${yesDiff}`);
  console.log(`  - No: ${noDiff > 0 ? '+' : ''}${noDiff}`);

  if (yesDiff !== 0 || noDiff !== 0) {
    console.log('\n❌ ข้อมูลไม่ตรงกัน! ต้องแก้ไข API เพื่อใช้ค่าจาก DB โดยตรง');
    console.log('💡 แนะนำ: Query count จาก DB แทนการนับจาก fetched data');
  } else {
    console.log('\n✅ ข้อมูลตรงกัน!');
  }
}

getPowerAuthorityCounts().catch(console.error);
