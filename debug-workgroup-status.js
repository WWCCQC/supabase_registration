/**
 * ตรวจสอบค่า workgroup_status ที่เป็น "หัวหน้า"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWorkgroupStatus() {
  console.log('🔍 ตรวจสอบ workgroup_status...\n');

  // 1. นับตาม SQL query ที่มีใน Supabase
  console.log('📊 === ตาม SQL Query (เหมือนภาพที่แนบ) ===');
  
  const { data: sqlResult, error: sqlError } = await supabase
    .rpc('execute_sql', {
      query: `
        SELECT 
          COUNT(*) as total_people,
          COUNT(CASE WHEN workgroup_status = 'หัวหน้า' THEN 1 END) as workgroup_count,
          ROUND(100.0 * COUNT(CASE WHEN workgroup_status = 'หัวหน้า' THEN 1 END) / COUNT(*), 2) as workgroup_percentage,
          NOW() as query_time
        FROM technicians
        WHERE rsm IS NOT NULL
          AND provider IS NOT NULL
          AND work_type IS NOT NULL;
      `
    });
  
  // ถ้า RPC ไม่มี ให้ใช้วิธีนับแบบปกติ
  console.log('📊 === นับด้วย Supabase Client ===\n');
  
  // 2. ดึงข้อมูลทั้งหมดที่มี WHERE conditions
  let allData = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('technicians')
      .select('workgroup_status, national_id, tech_id, full_name')
      .not('rsm', 'is', null)
      .not('provider', 'is', null)
      .not('work_type', 'is', null)
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    console.log(`   ดึงข้อมูล batch: ${data.length} รายการ, รวม: ${allData.length}`);
    
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`\n✅ ดึงข้อมูลทั้งหมด: ${allData.length} รายการ\n`);

  // 3. นับค่า workgroup_status ทั้งหมด
  console.log('📊 === การกระจายของ workgroup_status ===');
  const statusCount = {};
  allData.forEach(row => {
    const status = row.workgroup_status || 'NULL';
    statusCount[status] = (statusCount[status] || 0) + 1;
  });

  Object.entries(statusCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  "${status}": ${count} รายการ`);
    });

  console.log('');

  // 4. ตรวจสอบค่าที่ขึ้นต้นด้วย "ห"
  console.log('📊 === ค่าที่ขึ้นต้นด้วย "ห" ===');
  const startsWithH = allData.filter(row => {
    const status = row.workgroup_status || '';
    return status.startsWith('ห');
  });
  console.log(`จำนวน: ${startsWithH.length} รายการ\n`);

  // 5. ตรวจสอบค่าที่เป็น "หัวหน้า" แบบ exact match
  console.log('📊 === Exact match กับ "หัวหน้า" ===');
  const exactMatch = allData.filter(row => row.workgroup_status === 'หัวหน้า');
  console.log(`จำนวน: ${exactMatch.length} รายการ\n`);

  // 6. ตรวจสอบ encoding issues
  console.log('📊 === ตรวจสอบ Encoding Issues ===');
  const encodingIssues = allData.filter(row => {
    const status = row.workgroup_status || '';
    return status.includes('หัวหน') && status !== 'หัวหน้า';
  });
  
  if (encodingIssues.length > 0) {
    console.log(`⚠️  พบ encoding issues: ${encodingIssues.length} รายการ`);
    encodingIssues.slice(0, 5).forEach((row, idx) => {
      console.log(`   ${idx + 1}. status="${row.workgroup_status}" (${row.tech_id} - ${row.full_name})`);
      // แสดง hex code
      const hex = Buffer.from(row.workgroup_status, 'utf8').toString('hex');
      console.log(`      Hex: ${hex}`);
    });
  } else {
    console.log('✅ ไม่พบ encoding issues');
  }
  console.log('');

  // 7. นับ unique national_id ที่เป็นหัวหน้า
  console.log('📊 === นับ Unique National ID ===');
  const uniqueHeads = new Set();
  exactMatch.forEach(row => {
    const nationalId = row.national_id || '';
    if (nationalId && nationalId !== 'null' && nationalId !== 'undefined') {
      uniqueHeads.add(nationalId);
    }
  });
  console.log(`Unique national_id (หัวหน้า): ${uniqueHeads.size} รายการ\n`);

  // 8. สรุป
  console.log('📊 === สรุป ===');
  console.log(`ข้อมูลทั้งหมด (มี rsm, provider, work_type): ${allData.length}`);
  console.log(`workgroup_status = "หัวหน้า" (exact): ${exactMatch.length}`);
  console.log(`workgroup_status ขึ้นต้นด้วย "ห": ${startsWithH.length}`);
  console.log(`Unique national_id (หัวหน้า): ${uniqueHeads.size}`);
  console.log('');
  console.log('⚠️  ตามภาพที่แนบควรได้: 1787 รายการ');
  console.log(`📊 ตาม API ปัจจุบันได้: 1367 รายการ (ตาม console log)`);
  console.log(`❌ ต่างกัน: ${1787 - uniqueHeads.size} รายการ`);
}

checkWorkgroupStatus();
