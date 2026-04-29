// ตรวจสอบ Power Authority counts จาก API
// วิเคราะห์ว่า API นับ Yes/No อย่างไร

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPowerAuthorityCounts() {
  console.log('🔍 เริ่มตรวจสอบ Power Authority counts...\n');

  // 1. Query ข้อมูลจาก DB (ตรงตาม logic ของ API)
  const { data: allData, error } = await supabase
    .from('technicians')
    .select('national_id, power_authority, rsm, provider_name, work_type')
    .not('rsm', 'is', null)
    .not('provider_name', 'is', null)
    .not('work_type', 'is', null)
    .order('national_id', { ascending: true });

  if (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    return;
  }

  console.log(`📊 จำนวนข้อมูลที่ดึงมา: ${allData.length} รายการ\n`);

  // 2. นับ power_authority แบบ unique national_id (เหมือนใน API)
  const allYesNationalIds = new Set();
  const allNoNationalIds = new Set();
  const allNationalIds = new Set();
  const invalidAuthority = new Set();
  const nullAuthority = new Set();

  allData.forEach(row => {
    const powerAuthority = String(row.power_authority || "").trim();
    const nationalId = String(row.national_id || "").trim();
    
    // Skip records without national_id (เหมือนใน API)
    if (!nationalId || nationalId === "null" || nationalId === "undefined") return;
    
    allNationalIds.add(nationalId);
    
    if (powerAuthority && powerAuthority !== "null" && powerAuthority !== "undefined") {
      const cleanAuthority = powerAuthority.toLowerCase();
      
      if (cleanAuthority === "yes" || cleanAuthority === "y") {
        allYesNationalIds.add(nationalId);
      } else if (cleanAuthority === "no" || cleanAuthority === "n") {
        allNoNationalIds.add(nationalId);
      } else {
        // ค่าที่ไม่ใช่ Yes/No
        invalidAuthority.add(nationalId);
        console.log(`⚠️ พบค่าที่ไม่ใช่ Yes/No: "${powerAuthority}" (national_id: ${nationalId})`);
      }
    } else {
      nullAuthority.add(nationalId);
    }
  });

  console.log('\n📊 สรุปการนับ (ตาม logic ของ API):');
  console.log(`  - Total unique national_ids: ${allNationalIds.size}`);
  console.log(`  - Yes: ${allYesNationalIds.size} คน`);
  console.log(`  - No: ${allNoNationalIds.size} คน`);
  console.log(`  - Invalid (ไม่ใช่ Yes/No): ${invalidAuthority.size} คน`);
  console.log(`  - Null/Empty: ${nullAuthority.size} คน`);
  console.log(`  - รวม (Yes + No + Invalid + Null): ${allYesNationalIds.size + allNoNationalIds.size + invalidAuthority.size + nullAuthority.size}`);

  // 3. Query จาก DB แบบตรงๆ สำหรับ power_authority
  console.log('\n🔍 ตรวจสอบด้วย SQL Query แบบตรงๆ...');
  
  const { count: yesCount } = await supabase
    .from('technicians')
    .select('national_id', { count: 'exact', head: true })
    .not('rsm', 'is', null)
    .not('provider_name', 'is', null)
    .not('work_type', 'is', null)
    .ilike('power_authority', 'Yes');
    
  const { count: noCount } = await supabase
    .from('technicians')
    .select('national_id', { count: 'exact', head: true })
    .not('rsm', 'is', null)
    .not('provider_name', 'is', null)
    .not('work_type', 'is', null)
    .ilike('power_authority', 'No');
    
  console.log(`\n📊 จาก SQL Query (ไม่ unique):');
  console.log(`  - Yes: ${yesCount} records`);
  console.log(`  - No: ${noCount} records`);
  console.log(`  - Total: ${yesCount + noCount}`);

  // 4. เปรียบเทียบกับหน้าเว็บ
  console.log('\n📊 เปรียบเทียบผลลัพธ์:');
  console.log(`  หน้าเว็บแสดง: Yes: 400, No: 2,536 (Total: 2,936)`);
  console.log(`  API logic นับได้: Yes: ${allYesNationalIds.size}, No: ${allNoNationalIds.size} (Total: ${allYesNationalIds.size + allNoNationalIds.size})`);
  console.log(`  SQL Query: Yes: ${yesCount}, No: ${noCount} (Total: ${yesCount + noCount})`);
  
  if (allNoNationalIds.size !== noCount || allYesNationalIds.size !== yesCount) {
    console.log('\n❌ พบความไม่ตรงกัน!');
    console.log(`  Yes ต่างกัน: ${Math.abs(allYesNationalIds.size - yesCount)}`);
    console.log(`  No ต่างกัน: ${Math.abs(allNoNationalIds.size - noCount)}`);
  } else {
    console.log('\n✅ API logic และ SQL Query ตรงกัน');
  }

  // 5. ตรวจสอบว่ามี duplicate national_id ที่มี power_authority ต่างกันไหม
  console.log('\n🔍 ตรวจสอบ duplicate national_id with different power_authority...');
  const nationalIdPowerMap = new Map();
  
  allData.forEach(row => {
    const nationalId = String(row.national_id || "").trim();
    const powerAuthority = String(row.power_authority || "").trim().toLowerCase();
    
    if (!nationalId || nationalId === "null" || nationalId === "undefined") return;
    if (!powerAuthority || powerAuthority === "null" || powerAuthority === "undefined") return;
    
    if (!nationalIdPowerMap.has(nationalId)) {
      nationalIdPowerMap.set(nationalId, new Set());
    }
    
    nationalIdPowerMap.get(nationalId).add(powerAuthority);
  });
  
  let duplicatesWithDifferentAuthority = 0;
  nationalIdPowerMap.forEach((authorities, nationalId) => {
    if (authorities.size > 1) {
      console.log(`  ⚠️ national_id ${nationalId} มี power_authority หลายค่า: ${Array.from(authorities).join(', ')}`);
      duplicatesWithDifferentAuthority++;
    }
  });
  
  if (duplicatesWithDifferentAuthority === 0) {
    console.log('  ✅ ไม่พบ national_id ที่มี power_authority หลายค่า');
  } else {
    console.log(`  ❌ พบ ${duplicatesWithDifferentAuthority} national_id ที่มี power_authority หลายค่า`);
  }
}

checkPowerAuthorityCounts().catch(console.error);
