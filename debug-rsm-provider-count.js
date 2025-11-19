// ตรวจสอบว่าทำไม RSM Provider แสดง 2,086 แทนที่จะเป็น 2,095
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bxohkukccbuzrxrsuhrq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4b2hrdWtjY2J1enJ4cnN1aHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDc5MzI0NiwiZXhwIjoyMDQ2MzY5MjQ2fQ.bTL45QpYlmIHzor4SWJSn0HRZXzAZpQ6lqt7yuuQTKY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRSMProviderDiscrepancy() {
  console.log('🔍 ตรวจสอบทำไม RSM Provider แสดง 2,086 แทนที่จะเป็น 2,095');
  console.log('='.repeat(80));
  
  try {
    // 1. นับ WW-Provider ทั้งหมดในฐานข้อมูล
    console.log('\n📊 Step 1: นับ WW-Provider ทั้งหมด');
    console.log('-'.repeat(80));
    
    const { count: totalWW, error: countError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'WW-Provider');
    
    if (countError) {
      console.error('Error:', countError);
      return;
    }
    
    console.log(`✅ WW-Provider ทั้งหมด: ${totalWW} records`);
    
    // 2. ดึงข้อมูล WW-Provider ทั้งหมด
    console.log('\n📊 Step 2: ดึงข้อมูล WW-Provider ทั้งหมด');
    console.log('-'.repeat(80));
    
    let allWW = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('technicians')
        .select('national_id, rsm, provider')
        .eq('provider', 'WW-Provider')
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error('Error:', error);
        return;
      }
      
      if (!data || data.length === 0) break;
      
      allWW.push(...data);
      from += pageSize;
      
      if (data.length < pageSize) break;
    }
    
    console.log(`📥 ดึงข้อมูลได้: ${allWW.length} records`);
    
    // 3. วิเคราะห์ข้อมูล
    console.log('\n📊 Step 3: วิเคราะห์ข้อมูล');
    console.log('-'.repeat(80));
    
    const withoutNationalId = allWW.filter(r => !r.national_id || r.national_id.trim() === '');
    const withoutRSM = allWW.filter(r => !r.rsm || r.rsm.trim() === '' || r.rsm === 'null');
    const withBoth = allWW.filter(r => 
      r.national_id && r.national_id.trim() !== '' &&
      r.rsm && r.rsm.trim() !== '' && r.rsm !== 'null'
    );
    const withNationalIdButNoRSM = allWW.filter(r =>
      r.national_id && r.national_id.trim() !== '' &&
      (!r.rsm || r.rsm.trim() === '' || r.rsm === 'null')
    );
    
    console.log(`📊 ไม่มี national_id:                    ${withoutNationalId.length} records`);
    console.log(`📊 ไม่มี RSM:                            ${withoutRSM.length} records`);
    console.log(`📊 มีทั้ง national_id และ RSM:          ${withBoth.length} records`);
    console.log(`📊 มี national_id แต่ไม่มี RSM:         ${withNationalIdButNoRSM.length} records`);
    
    // 4. ตรวจสอบ national_id ซ้ำ
    console.log('\n📊 Step 4: ตรวจสอบ national_id ซ้ำ');
    console.log('-'.repeat(80));
    
    const nationalIdMap = new Map();
    allWW.forEach(r => {
      if (r.national_id && r.national_id.trim() !== '') {
        const id = r.national_id.trim();
        if (!nationalIdMap.has(id)) {
          nationalIdMap.set(id, []);
        }
        nationalIdMap.get(id).push(r);
      }
    });
    
    const duplicates = Array.from(nationalIdMap.entries()).filter(([id, records]) => records.length > 1);
    
    if (duplicates.length > 0) {
      console.log(`❌ พบ national_id ซ้ำ: ${duplicates.length} รายการ`);
      console.log('ตัวอย่าง 3 รายการแรก:');
      duplicates.slice(0, 3).forEach(([id, records]) => {
        console.log(`  National ID: ${id} (ซ้ำ ${records.length} ครั้ง)`);
        records.forEach((r, i) => {
          console.log(`    ${i + 1}. RSM: ${r.rsm || 'N/A'}`);
        });
      });
    } else {
      console.log(`✅ ไม่พบ national_id ซ้ำ`);
    }
    
    const uniqueNationalIds = nationalIdMap.size;
    console.log(`\n📊 Unique national_id: ${uniqueNationalIds} รายการ`);
    
    // 5. คำนวณตามที่ API ทำ
    console.log('\n📊 Step 5: คำนวณตามที่ API ทำ');
    console.log('-'.repeat(80));
    
    // ตาม API logic ใหม่: รวม records ที่ไม่มี RSM ด้วย
    const validRecords = allWW.filter(r => 
      r.national_id && r.national_id.trim() !== ''
    );
    
    const uniqueValidIds = new Set();
    validRecords.forEach(r => {
      uniqueValidIds.add(r.national_id.trim());
    });
    
    console.log(`✅ Records ที่มี national_id:           ${validRecords.length} records`);
    console.log(`✅ Unique national_id (ที่ API นับ):    ${uniqueValidIds.size} records`);
    
    // 6. สรุปความแตกต่าง
    console.log('\n🎯 สรุปผลลัพธ์');
    console.log('='.repeat(80));
    console.log(`WW-Provider ทั้งหมดใน DB:               ${totalWW} records`);
    console.log(`Unique national_id (ควรแสดง):          ${uniqueValidIds.size} records`);
    console.log(`ที่แสดงในกราฟ (จากรูป):                2,086 records`);
    console.log(`ความแตกต่าง:                           ${uniqueValidIds.size - 2086} records`);
    
    if (uniqueValidIds.size !== 2095) {
      console.log(`\n⚠️  ข้อมูลจริงในฐานข้อมูลไม่ใช่ 2,095!`);
      console.log(`   ข้อมูลจริง = ${uniqueValidIds.size} unique national_id`);
      console.log(`   อาจมีการเปลี่ยนแปลงข้อมูลหลังจากที่คุณดูครั้งก่อน`);
    }
    
    // 7. ตรวจสอบว่า API กรองอะไรออกบ้าง
    console.log('\n💡 การกรองของ API:');
    console.log('='.repeat(80));
    console.log(`1. กรอง records ที่ไม่มี national_id:   -${withoutNationalId.length} records`);
    console.log(`2. กรอง records ที่ไม่มี provider:      (ไม่มี - เพราะ query .eq('provider', 'WW-Provider'))`);
    console.log(`3. เก็บ unique national_id เท่านั้น:   ${uniqueValidIds.size} records`);
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugRSMProviderDiscrepancy();
