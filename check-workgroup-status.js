const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkWorkgroupStatus() {
  console.log('🔍 ตรวจสอบค่าต่าง ๆ ของ workgroup_status...\n');
  
  let allData = [];
  let page = 0;
  
  while (true) {
    const { data } = await supabase
      .from('technicians')
      .select('tech_id, full_name, workgroup_status, rsm, provider, work_type')
      .not('rsm', 'is', null)
      .not('provider', 'is', null)
      .not('work_type', 'is', null)
      .range(page * 1000, (page + 1) * 1000 - 1);
    
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  
  console.log(`✅ ดึงข้อมูลได้: ${allData.length} records\n`);
  
  // นับค่า workgroup_status ทั้งหมด
  const statusCounts = {};
  allData.forEach(row => {
    const status = row.workgroup_status || '(null)';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  console.log('📊 ค่าทั้งหมดของ workgroup_status:');
  console.log('═══════════════════════════════════════');
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      // แสดงทั้ง text และ hex encoding
      const hex = Buffer.from(status, 'utf8').toString('hex');
      console.log(`  "${status}" (${count}) - hex: ${hex}`);
    });
  console.log('═══════════════════════════════════════\n');
  
  // เช็คว่ามีกี่แบบที่มีคำว่า "หัว"
  const headVariants = Object.keys(statusCounts).filter(s => s.includes('หัว'));
  console.log(`🔍 พบคำที่มี "หัว" จำนวน ${headVariants.length} แบบ:`);
  headVariants.forEach(v => {
    const hex = Buffer.from(v, 'utf8').toString('hex');
    console.log(`  "${v}" (${statusCounts[v]}) - hex: ${hex}`);
  });
  console.log('');
  
  // Test eq vs startsWith
  const { count: eqCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .not('rsm', 'is', null)
    .not('provider', 'is', null)
    .not('work_type', 'is', null)
    .eq('workgroup_status', 'หัวหน้า');
  
  console.log('✅ ทดสอบ Query:');
  console.log(`  .eq('workgroup_status', 'หัวหน้า') = ${eqCount} records`);
  
  // นับจาก fetched data
  const headsFromFetch = allData.filter(r => r.workgroup_status === 'หัวหน้า').length;
  const headsStartsWithH = allData.filter(r => {
    const status = r.workgroup_status || '';
    return status.startsWith('ห');
  }).length;
  
  console.log(`  ข้อมูลที่ fetch มา status === 'หัวหน้า' = ${headsFromFetch} records`);
  console.log(`  ข้อมูลที่ fetch มา startsWith('ห') = ${headsStartsWithH} records`);
  console.log('');
  
  // แสดงตัวอย่างที่ไม่ใช่ "หัวหน้า" มาตรฐาน
  const nonStandardHeads = allData.filter(r => {
    const status = r.workgroup_status || '';
    return status.startsWith('ห') && status !== 'หัวหน้า';
  });
  
  if (nonStandardHeads.length > 0) {
    console.log('⚠️  พบข้อมูล "หัวหน้า" ที่ encoding ผิด:');
    nonStandardHeads.slice(0, 5).forEach(r => {
      const hex = Buffer.from(r.workgroup_status, 'utf8').toString('hex');
      console.log(`  - tech_id: ${r.tech_id}, status: "${r.workgroup_status}", hex: ${hex}`);
    });
    console.log(`  (รวม ${nonStandardHeads.length} records)\n`);
  }
  
  // สรุปปัญหา
  console.log('📝 สรุป:');
  console.log('═══════════════════════════════════════');
  console.log(`  จำนวนกองงานที่ควรจะเป็น: ${eqCount}`);
  console.log(`  จำนวนที่ API นับได้ (startsWith): ${headsStartsWithH}`);
  console.log(`  ส่วนต่าง: ${headsStartsWithH - eqCount}`);
  
  if (headsStartsWithH !== eqCount) {
    console.log(`  ⚠️  มี encoding issue: ${headsStartsWithH - eqCount} records`);
  } else {
    console.log(`  ✅ ข้อมูลถูกต้อง ไม่มี encoding issue`);
  }
}

checkWorkgroupStatus();
