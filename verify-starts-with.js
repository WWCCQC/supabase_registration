const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyWithStartsWith() {
  console.log('🔍 ตรวจสอบการนับด้วย startsWith("ห")...\n');
  
  let allData = [];
  let page = 0;
  
  while (true) {
    const { data } = await supabase
      .from('technicians')
      .select('tech_id, workgroup_status, rsm, provider, work_type')
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
  
  // นับด้วย startsWith
  const headsWithStartsWith = allData.filter(r => {
    const status = r.workgroup_status || '';
    return status.startsWith('ห');
  });
  
  console.log('📊 การนับด้วย startsWith("ห"):');
  console.log(`  จำนวนหัวหน้าทั้งหมด: ${headsWithStartsWith.length}`);
  console.log('');
  
  // แยกตามประเภท
  const exactMatch = headsWithStartsWith.filter(r => r.workgroup_status === 'หัวหน้า');
  const badEncoding = headsWithStartsWith.filter(r => r.workgroup_status !== 'หัวหน้า');
  
  console.log('  แยกเป็น:');
  console.log(`    - "หัวหน้า" (ปกติ): ${exactMatch.length}`);
  console.log(`    - encoding ผิด: ${badEncoding.length}`);
  
  if (badEncoding.length > 0) {
    console.log('\n  รายละเอียด encoding ผิด:');
    badEncoding.forEach(r => {
      console.log(`    - tech_id: ${r.tech_id}, status: "${r.workgroup_status}"`);
    });
  }
  
  console.log('\n📊 Grand Total:');
  const totalAll = allData.length;
  const totalHeads = headsWithStartsWith.length;
  console.log(`  ${totalAll}(${totalHeads})`);
  
  console.log('\n📊 RSM1_BMA-West (ตัวอย่าง):');
  const rsm1All = allData.filter(r => r.rsm === 'RSM1_BMA-West');
  const rsm1Heads = rsm1All.filter(r => {
    const status = r.workgroup_status || '';
    return status.startsWith('ห');
  });
  console.log(`  Total: ${rsm1All.length}(${rsm1Heads.length})`);
  
  // WW-Provider
  const wwp = rsm1All.filter(r => r.provider === 'WW-Provider');
  const wwpHeads = rsm1Heads.filter(r => r.provider === 'WW-Provider');
  console.log(`  WW-Provider: ${wwp.length}(${wwpHeads.length})`);
  
  const wwpInst = wwp.filter(r => r.work_type === 'Installation');
  const wwpInstHeads = wwpHeads.filter(r => r.work_type === 'Installation');
  console.log(`    Installation: ${wwpInst.length}(${wwpInstHeads.length})`);
  
  const wwpRep = wwp.filter(r => r.work_type === 'Repair');
  const wwpRepHeads = wwpHeads.filter(r => r.work_type === 'Repair');
  console.log(`    Repair: ${wwpRep.length}(${wwpRepHeads.length})`);
}

verifyWithStartsWith();
