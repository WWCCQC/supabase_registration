const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function compareWithImage() {
  console.log('🔍 เปรียบเทียบตัวเลขกับที่แสดงในรูป...\n');
  
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
  
  // Function to count heads (startsWith "ห")
  const countHeads = (data) => {
    return data.filter(r => {
      const status = r.workgroup_status || '';
      return status.startsWith('ห');
    }).length;
  };
  
  // ตรวจสอบแต่ละ RSM ตามรูป
  const rsmList = [
    'RSM1_BMA-West',
    'RSM2_BMA-East',
    'RSM3_UPC-East',
    'RSM4_UPC-NOR',
    'RSM5_UPC-NOE1',
    'RSM6_UPC-NOE2',
    'RSM7_UPC-CEW',
    'RSM8_UPC-SOU'
  ];
  
  console.log('📊 เปรียบเทียบตัวเลขกับรูป:');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('RSM'.padEnd(20) + 'ในรูป'.padStart(12) + 'จากDB'.padStart(12) + 'ตรงกัน?'.padStart(12));
  console.log('───────────────────────────────────────────────────────────────────────────');
  
  // Grand Total
  const grandTotalHeads = countHeads(allData);
  console.log('Grand Total'.padEnd(20) + '1787'.padStart(12) + String(grandTotalHeads).padStart(12) + (grandTotalHeads === 1787 ? '❌ (ได้ 1789)' : '').padStart(12));
  
  // แต่ละ RSM
  const imageValues = {
    'RSM1_BMA-West': 253,
    'RSM2_BMA-East': 450,
    'RSM3_UPC-East': 192,
    'RSM4_UPC-NOR': 188,
    'RSM5_UPC-NOE1': 164,
    'RSM6_UPC-NOE2': 153,
    'RSM7_UPC-CEW': 221,
    'RSM8_UPC-SOU': 168
  };
  
  let totalDiff = 0;
  
  rsmList.forEach(rsm => {
    const rsmData = allData.filter(r => r.rsm === rsm);
    const rsmHeads = countHeads(rsmData);
    const imageValue = imageValues[rsm];
    const diff = rsmHeads - imageValue;
    totalDiff += Math.abs(diff);
    
    const match = diff === 0 ? '✅' : `❌ (${diff > 0 ? '+' : ''}${diff})`;
    console.log(rsm.padEnd(20) + String(imageValue).padStart(12) + String(rsmHeads).padStart(12) + match.padStart(12));
  });
  
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`\nรวมส่วนต่าง: ${totalDiff} records`);
  
  // ตรวจสอบ WW-Provider Installation สำหรับแต่ละ RSM
  console.log('\n📊 ตรวจสอบ WW-Provider Installation แต่ละ RSM:');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  const wwpInstImageValues = {
    'RSM1_BMA-West': 124,
    'RSM2_BMA-East': 202,
    'RSM3_UPC-East': 122,
    'RSM4_UPC-NOR': 97,
    'RSM5_UPC-NOE1': 90,
    'RSM6_UPC-NOE2': 85,
    'RSM7_UPC-CEW': 137,
    'RSM8_UPC-SOU': 83
  };
  
  rsmList.forEach(rsm => {
    const data = allData.filter(r => 
      r.rsm === rsm && 
      r.provider === 'WW-Provider' && 
      r.work_type === 'Installation'
    );
    const heads = countHeads(data);
    const imageValue = wwpInstImageValues[rsm];
    const match = heads === imageValue ? '✅' : `❌ (${heads - imageValue > 0 ? '+' : ''}${heads - imageValue})`;
    
    console.log(`${rsm}: ในรูป=${imageValue}, จากDB=${heads} ${match}`);
  });
  
  console.log('\n💡 หมายเหตุ: ถ้าตัวเลขไม่ตรงกัน อาจเป็นเพราะ:');
  console.log('  1. ข้อมูลใน Supabase ถูกอัปเดตหลังจากที่ถ่ายรูป');
  console.log('  2. API ยังใช้ cache เก่าอยู่ (ต้องรอ redeploy)');
  console.log('  3. มี filter หรือเงื่อนไขที่แตกต่างกัน');
}

compareWithImage();
