/**
 * สคริปต์หาข้อมูลที่หายไป 18 รายการ
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findMissingRecords() {
  console.log('🔍 ค้นหาข้อมูลที่หายไป 18 รายการ...\n');

  try {
    // 1. นับข้อมูลทั้งหมด
    const { count: totalCount } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 จำนวนข้อมูลทั้งหมด: ${totalCount} รายการ\n`);

    // 2. ดึงข้อมูลทั้งหมดแบบ paginate
    console.log('🔄 กำลังดึงข้อมูลทั้งหมดแบบ paginate...');
    let allData = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .range(from, from + pageSize - 1);
      
      if (error) throw error;
      
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      console.log(`   ดึงข้อมูล batch: ${data.length} รายการ, รวม: ${allData.length}`);
      
      if (data.length < pageSize) break;
      from += pageSize;
    }

    console.log(`\n✅ ดึงข้อมูลทั้งหมดได้: ${allData.length} รายการ`);
    const missingCount = totalCount - allData.length;
    
    if (missingCount === 0) {
      console.log('✅ ไม่มีข้อมูลหายไป! ทุกอย่างปกติ\n');
      return;
    }

    console.log(`\n⚠️  มีข้อมูลหายไป: ${missingCount} รายการ\n`);

    // 3. ตรวจสอบข้อมูลที่อาจมีปัญหา
    console.log('🔍 ตรวจสอบข้อมูลที่อาจมีปัญหา:\n');

    // 3.1 ตรวจสอบ encoding issues
    const encodingIssues = allData.filter(row => {
      const fullName = row.full_name || '';
      // ตรวจสอบตัวอักษรพิเศษหรือ emoji
      return /[\uFFFD\u200B-\u200D\uFEFF]/.test(fullName) || 
             fullName.includes('�');
    });
    
    if (encodingIssues.length > 0) {
      console.log(`📝 พบข้อมูลที่มีปัญหา encoding: ${encodingIssues.length} รายการ`);
      encodingIssues.slice(0, 5).forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.tech_id} - ${row.full_name}`);
      });
      console.log('');
    }

    // 3.2 ตรวจสอบข้อมูลที่ซ้ำกัน
    const techIdMap = new Map();
    allData.forEach(row => {
      const techId = row.tech_id;
      if (techIdMap.has(techId)) {
        techIdMap.set(techId, techIdMap.get(techId) + 1);
      } else {
        techIdMap.set(techId, 1);
      }
    });

    const duplicates = Array.from(techIdMap.entries())
      .filter(([_, count]) => count > 1);
    
    if (duplicates.length > 0) {
      console.log(`📝 พบข้อมูลที่ tech_id ซ้ำกัน: ${duplicates.length} รายการ`);
      duplicates.slice(0, 5).forEach(([techId, count]) => {
        console.log(`   tech_id: ${techId} - ปรากฏ ${count} ครั้ง`);
      });
      console.log('');
    }

    // 3.3 ตรวจสอบข้อมูลที่มี NULL ในฟิลด์สำคัญ
    const criticalFields = ['tech_id', 'full_name', 'work_type', 'provider', 'rsm'];
    const nullIssues = {};
    
    criticalFields.forEach(field => {
      const nullCount = allData.filter(row => !row[field] || row[field] === '').length;
      if (nullCount > 0) {
        nullIssues[field] = nullCount;
      }
    });

    if (Object.keys(nullIssues).length > 0) {
      console.log('📝 พบข้อมูลที่มีฟิลด์สำคัญเป็น NULL หรือว่าง:');
      Object.entries(nullIssues).forEach(([field, count]) => {
        console.log(`   ${field}: ${count} รายการ`);
      });
      console.log('');
    }

    // 4. เปรียบเทียบกับการ query แบบมี WHERE condition
    console.log('🔍 ทดสอบ query แบบมี WHERE condition...\n');

    // 4.1 Query ที่ไม่มี NULL ในฟิลด์สำคัญ
    const { count: nonNullCount } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .not('tech_id', 'is', null)
      .not('full_name', 'is', null)
      .not('work_type', 'is', null)
      .not('provider', 'is', null)
      .not('rsm', 'is', null);
    
    console.log(`📊 จำนวนข้อมูลที่ไม่มี NULL ในฟิลด์สำคัญ: ${nonNullCount} รายการ`);
    console.log(`   ต่างจากข้อมูลทั้งหมด: ${totalCount - nonNullCount} รายการ\n`);

    // 4.2 Query ที่มี work_type และ provider
    const { count: validCount } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .not('work_type', 'is', null)
      .not('provider', 'is', null);
    
    console.log(`📊 จำนวนข้อมูลที่มี work_type และ provider: ${validCount} รายการ`);
    console.log(`   ต่างจากข้อมูลทั้งหมด: ${totalCount - validCount} รายการ\n`);

    // 5. แสดงข้อมูลที่อาจเป็นปัญหา (ไม่มี work_type หรือ provider)
    const { data: problematicData } = await supabase
      .from('technicians')
      .select('tech_id, full_name, work_type, provider, rsm, workgroup_status')
      .or('work_type.is.null,provider.is.null')
      .limit(10);
    
    if (problematicData && problematicData.length > 0) {
      console.log(`⚠️  ข้อมูลที่ไม่มี work_type หรือ provider (${problematicData.length} รายการแรก):`);
      problematicData.forEach((row, idx) => {
        console.log(`\n${idx + 1}. ${row.tech_id} - ${row.full_name}`);
        console.log(`   Work Type: ${row.work_type || 'NULL'}`);
        console.log(`   Provider: ${row.provider || 'NULL'}`);
        console.log(`   RSM: ${row.rsm || 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

findMissingRecords();
