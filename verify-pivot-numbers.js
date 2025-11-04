const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyPivotNumbers() {
  console.log('🔍 ตรวจสอบตัวเลขในตาราง Pivot...\n');
  
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
  
  // Grand Total
  const totalAll = allData.length;
  const totalHeads = allData.filter(r => r.workgroup_status === 'หัวหน้า').length;
  
  console.log('📊 Grand Total ที่ควรแสดงในตาราง:');
  console.log(`  ${totalAll}(${totalHeads})`);
  console.log('');
  
  // ตัวอย่าง RSM1_BMA-West
  const rsm1 = allData.filter(r => r.rsm === 'RSM1_BMA-West');
  const rsm1Heads = rsm1.filter(r => r.workgroup_status === 'หัวหน้า');
  
  console.log('📊 RSM1_BMA-West (ตัวอย่าง):');
  console.log(`  Total: ${rsm1.length}(${rsm1Heads.length})`);
  
  // WW-Provider
  const wwp = rsm1.filter(r => r.provider === 'WW-Provider');
  const wwpHeads = rsm1Heads.filter(r => r.provider === 'WW-Provider');
  console.log(`  WW-Provider Total: ${wwp.length}(${wwpHeads.length})`);
  
  const wwpInst = wwp.filter(r => r.work_type === 'Installation');
  const wwpInstHeads = wwpHeads.filter(r => r.work_type === 'Installation');
  console.log(`    Installation: ${wwpInst.length}(${wwpInstHeads.length})`);
  
  const wwpRep = wwp.filter(r => r.work_type === 'Repair');
  const wwpRepHeads = wwpHeads.filter(r => r.work_type === 'Repair');
  console.log(`    Repair: ${wwpRep.length}(${wwpRepHeads.length})`);
  
  // True Tech
  const tt = rsm1.filter(r => r.provider === 'True Tech');
  const ttHeads = rsm1Heads.filter(r => r.provider === 'True Tech');
  console.log(`  True Tech Total: ${tt.length}(${ttHeads.length})`);
  
  console.log('\n✅ ตรวจสอบเสร็จสิ้น');
}

verifyPivotNumbers();
