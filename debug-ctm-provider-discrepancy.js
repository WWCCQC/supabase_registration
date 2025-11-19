const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bxohkukccbuzrxrsuhrq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4b2hrdWtjY2J1enJ4cnN1aHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDc5MzI0NiwiZXhwIjoyMDQ2MzY5MjQ2fQ.bTL45QpYlmIHzor4SWJSn0HRZXzAZpQ6lqt7yuuQTKY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCTMProviderDiscrepancy() {
  console.log('🔍 ตรวจสอบความแตกต่างของ WW-Provider ในกราฟ CTM Provider Distribution\n');
  console.log('='.repeat(80));
  
  try {
    // 1. นับ WW-Provider โดยตรง (วิธีที่ API ใช้สำหรับ summary)
    console.log('\n📊 วิธีที่ 1: นับโดยตรงจาก Database (สำหรับ Summary)');
    console.log('-'.repeat(80));
    
    const { count: directCount, error: directError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'WW-Provider');
    
    if (directError) {
      console.error('Error:', directError);
      return;
    }
    
    console.log(`✅ WW-Provider (นับโดยตรง): ${directCount?.toLocaleString()} records`);
    
    // 2. ดึงข้อมูล WW-Provider ทั้งหมดและนับ unique national_id (วิธีที่กราฟใช้)
    console.log('\n📊 วิธีที่ 2: ดึงข้อมูลทั้งหมดและนับ unique national_id (สำหรับกราฟ)');
    console.log('-'.repeat(80));
    
    let allWWData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const to = from + pageSize - 1;
      const { data: pageData, error: pageError } = await supabase
        .from('technicians')
        .select('ctm, provider, national_id')
        .eq('provider', 'WW-Provider')
        .range(from, to);
      
      if (pageError) {
        console.error('Pagination error:', pageError);
        return;
      }
      
      if (pageData && pageData.length > 0) {
        allWWData.push(...pageData);
        from += pageSize;
        hasMore = pageData.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📥 ดึงข้อมูลทั้งหมด: ${allWWData.length.toLocaleString()} records`);
    
    // นับ unique national_id
    const uniqueNationalIds = new Set();
    const recordsWithoutNationalId = [];
    const duplicateNationalIds = new Map();
    
    allWWData.forEach((record) => {
      const nationalId = record.national_id;
      
      if (!nationalId) {
        recordsWithoutNationalId.push(record);
      } else {
        if (uniqueNationalIds.has(nationalId)) {
          if (!duplicateNationalIds.has(nationalId)) {
            duplicateNationalIds.set(nationalId, []);
          }
          duplicateNationalIds.get(nationalId).push(record);
        }
        uniqueNationalIds.add(nationalId);
      }
    });
    
    console.log(`✅ Unique national_id: ${uniqueNationalIds.size.toLocaleString()} records`);
    console.log(`❌ Records ไม่มี national_id: ${recordsWithoutNationalId.length.toLocaleString()} records`);
    console.log(`🔁 Duplicate national_id: ${duplicateNationalIds.size.toLocaleString()} unique IDs`);
    
    // 3. แสดงความแตกต่าง
    console.log('\n🎯 สรุปผลลัพธ์');
    console.log('='.repeat(80));
    console.log(`การนับโดยตรง (Summary):        ${directCount?.toLocaleString()} records`);
    console.log(`การนับ unique ID (กราฟ):       ${uniqueNationalIds.size.toLocaleString()} records`);
    console.log(`ความแตกต่าง:                   ${Math.abs((directCount || 0) - uniqueNationalIds.size).toLocaleString()} records`);
    
    if (recordsWithoutNationalId.length > 0) {
      console.log(`\n⚠️  มี ${recordsWithoutNationalId.length} records ที่ไม่มี national_id:`);
      console.log('ตัวอย่างแรก 5 records:');
      recordsWithoutNationalId.slice(0, 5).forEach((record, i) => {
        console.log(`  ${i + 1}. CTM: ${record.ctm || 'N/A'}, Provider: ${record.provider}`);
      });
    }
    
    if (duplicateNationalIds.size > 0) {
      console.log(`\n🔁 มี ${duplicateNationalIds.size} national_id ที่ซ้ำ:`);
      console.log('ตัวอย่างแรก 5 กรณี:');
      let count = 0;
      for (const [nationalId, records] of duplicateNationalIds.entries()) {
        if (count >= 5) break;
        console.log(`  ${count + 1}. National ID: ${nationalId} (ซ้ำ ${records.length + 1} ครั้ง)`);
        console.log(`     CTMs: ${records.map(r => r.ctm || 'N/A').join(', ')}`);
        count++;
      }
    }
    
    // 4. ตรวจสอบว่ากราฟแสดงค่าไหน
    console.log('\n📈 การแสดงผลในกราฟ');
    console.log('='.repeat(80));
    console.log('ตามโค้ดใน API:');
    console.log('  - Summary (ตัวเลขด้านบน): ใช้การนับโดยตรง =', directCount?.toLocaleString());
    console.log('  - กราฟ (แท่งกราฟ): ใช้การนับ unique national_id =', uniqueNationalIds.size.toLocaleString());
    console.log('\n💡 สาเหตุที่ตัวเลขไม่ตรงกัน:');
    
    if (recordsWithoutNationalId.length > 0) {
      console.log(`  ✓ มี ${recordsWithoutNationalId.length} records ที่ไม่มี national_id ถูกกรองออกจากกราฟ`);
    }
    if (duplicateNationalIds.size > 0) {
      let totalDuplicates = 0;
      for (const records of duplicateNationalIds.values()) {
        totalDuplicates += records.length;
      }
      console.log(`  ✓ มี national_id ซ้ำทั้งหมด ${totalDuplicates} records ถูกรวมเป็น unique ในกราฟ`);
    }
    
    const expectedDifference = recordsWithoutNationalId.length;
    console.log(`\n🔢 ความแตกต่างที่คาดหวัง: ${expectedDifference} records`);
    console.log(`🔢 ความแตกต่างจริง: ${Math.abs((directCount || 0) - uniqueNationalIds.size)} records`);
    
    if (expectedDifference === Math.abs((directCount || 0) - uniqueNationalIds.size)) {
      console.log('✅ ตรงกัน! ปัญหามาจาก records ที่ไม่มี national_id');
    } else {
      console.log('⚠️  ไม่ตรงกัน อาจมีปัญหาอื่นๆ เพิ่มเติม');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugCTMProviderDiscrepancy();
