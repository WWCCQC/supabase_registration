/**
 * สคริปต์ตรวจสอบข้อมูลจริงจาก Supabase
 * เพื่อเปรียบเทียบกับข้อมูลที่แสดงบนหน้าเว็บ
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

async function checkRealData() {
  console.log('🔍 กำลังดึงข้อมูลจริงจาก Supabase...\n');

  try {
    // 1. ตรวจสอบจำนวนข้อมูลทั้งหมด
    console.log('📊 === ข้อมูลทั้งหมด ===');
    const { count: totalCount, error: countError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    console.log(`✅ จำนวนข้อมูลทั้งหมด: ${totalCount} รายการ\n`);

    // 2. ตรวจสอบการกระจายตาม work_type
    console.log('📊 === การกระจายตาม Work Type ===');
    const { data: workTypeData, error: workTypeError } = await supabase
      .from('technicians')
      .select('work_type')
      .not('work_type', 'is', null);
    
    if (workTypeError) throw workTypeError;
    
    const workTypeCount = {};
    workTypeData.forEach(row => {
      const type = row.work_type || 'ไม่ระบุ';
      workTypeCount[type] = (workTypeCount[type] || 0) + 1;
    });
    
    Object.entries(workTypeCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const percent = ((count / totalCount) * 100).toFixed(2);
        console.log(`  ${type}: ${count} (${percent}%)`);
      });
    console.log('');

    // 3. ตรวจสอบการกระจายตาม provider
    console.log('📊 === การกระจายตาม Provider ===');
    const { data: providerData, error: providerError } = await supabase
      .from('technicians')
      .select('provider')
      .not('provider', 'is', null);
    
    if (providerError) throw providerError;
    
    const providerCount = {};
    providerData.forEach(row => {
      const provider = row.provider || 'ไม่ระบุ';
      providerCount[provider] = (providerCount[provider] || 0) + 1;
    });
    
    Object.entries(providerCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([provider, count]) => {
        const percent = ((count / totalCount) * 100).toFixed(2);
        console.log(`  ${provider}: ${count} (${percent}%)`);
      });
    console.log('');

    // 4. ตรวจสอบการกระจายตาม RSM
    console.log('📊 === การกระจายตาม RSM (Top 10) ===');
    const { data: rsmData, error: rsmError } = await supabase
      .from('technicians')
      .select('rsm')
      .not('rsm', 'is', null);
    
    if (rsmError) throw rsmError;
    
    const rsmCount = {};
    rsmData.forEach(row => {
      const rsm = row.rsm || 'ไม่ระบุ';
      rsmCount[rsm] = (rsmCount[rsm] || 0) + 1;
    });
    
    Object.entries(rsmCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([rsm, count]) => {
        const percent = ((count / totalCount) * 100).toFixed(2);
        console.log(`  ${rsm}: ${count} (${percent}%)`);
      });
    console.log('');

    // 5. ตรวจสอบการกระจายตาม Power Authority
    console.log('📊 === การกระจายตาม Power Authority ===');
    const { data: powerData, error: powerError } = await supabase
      .from('technicians')
      .select('power_authority');
    
    if (powerError) throw powerError;
    
    const powerCount = {};
    powerData.forEach(row => {
      const power = row.power_authority || 'ไม่ระบุ';
      powerCount[power] = (powerCount[power] || 0) + 1;
    });
    
    Object.entries(powerCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([power, count]) => {
        const percent = ((count / totalCount) * 100).toFixed(2);
        console.log(`  ${power}: ${count} (${percent}%)`);
      });
    console.log('');

    // 6. ตรวจสอบการกระจายตาม Workgroup Status
    console.log('📊 === การกระจายตาม Workgroup Status ===');
    const { data: statusData, error: statusError } = await supabase
      .from('technicians')
      .select('workgroup_status');
    
    if (statusError) throw statusError;
    
    const statusCount = {};
    statusData.forEach(row => {
      const status = row.workgroup_status || 'ไม่ระบุ';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    Object.entries(statusCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        const percent = ((count / totalCount) * 100).toFixed(2);
        console.log(`  ${status}: ${count} (${percent}%)`);
      });
    console.log('');

    // 7. ตรวจสอบจำนวน Depot Code ที่ไม่ซ้ำกัน
    console.log('📊 === Depot Codes ===');
    const { data: depotData, error: depotError } = await supabase
      .from('technicians')
      .select('depot_code')
      .not('depot_code', 'is', null);
    
    if (depotError) throw depotError;
    
    const uniqueDepots = new Set(depotData.map(r => r.depot_code));
    console.log(`✅ จำนวน Depot Code ที่ไม่ซ้ำกัน: ${uniqueDepots.size} แห่ง\n`);

    // 8. ตรวจสอบข้อมูลตัวอย่าง 5 รายการแรก
    console.log('📊 === ข้อมูลตัวอย่าง 5 รายการแรก ===');
    const { data: sampleData, error: sampleError } = await supabase
      .from('technicians')
      .select('tech_id, full_name, work_type, provider, rsm, workgroup_status, power_authority')
      .order('tech_id', { ascending: true })
      .limit(5);
    
    if (sampleError) throw sampleError;
    
    sampleData.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ${row.tech_id} - ${row.full_name}`);
      console.log(`   Work Type: ${row.work_type || 'ไม่ระบุ'}`);
      console.log(`   Provider: ${row.provider || 'ไม่ระบุ'}`);
      console.log(`   RSM: ${row.rsm || 'ไม่ระบุ'}`);
      console.log(`   Workgroup Status: ${row.workgroup_status || 'ไม่ระบุ'}`);
      console.log(`   Power Authority: ${row.power_authority || 'ไม่ระบุ'}`);
    });
    console.log('');

    // 9. ตรวจสอบข้อมูลที่มีค่า NULL หรือว่างเปล่า
    console.log('📊 === ตรวจสอบข้อมูลที่ขาดหาย ===');
    
    const fieldsToCheck = [
      'tech_id', 'full_name', 'work_type', 'provider', 
      'rsm', 'workgroup_status', 'power_authority', 'depot_code'
    ];
    
    for (const field of fieldsToCheck) {
      const { count: nullCount } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .or(`${field}.is.null,${field}.eq.`);
      
      const percent = ((nullCount / totalCount) * 100).toFixed(2);
      console.log(`  ${field}: ${nullCount} รายการ (${percent}%) มีค่าว่างหรือ NULL`);
    }
    console.log('');

    // 10. เปรียบเทียบกับ API endpoint
    console.log('📊 === เรียก API /api/kpis เพื่อเปรียบเทียบ ===');
    console.log('⚠️  กรุณาเปิดเบราว์เซอร์และตรวจสอบ:');
    console.log('   http://localhost:3000/api/kpis');
    console.log('   http://localhost:3000/api/technicians?page=1&pageSize=10');
    console.log('   http://localhost:3000/api/chart/rsm-workgroup');
    console.log('');

    console.log('✅ การตรวจสอบข้อมูลเสร็จสมบูรณ์');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.details) console.error('   รายละเอียด:', error.details);
    if (error.hint) console.error('   คำแนะนำ:', error.hint);
  }
}

// เรียกใช้ฟังก์ชัน
checkRealData();
