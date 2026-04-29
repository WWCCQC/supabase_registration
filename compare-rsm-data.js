// เปรียบเทียบข้อมูล API กับตารางที่ถูกต้อง
async function compareWithCorrectData() {
  console.log('🔍 เปรียบเทียบข้อมูล RSM Provider Distribution');
  console.log('='.repeat(120));
  
  // ข้อมูลที่ถูกต้องจากตารางของคุณ
  const correctData = {
    'RSM1_BMA-West': 251,
    'RSM2_BMA-East': 352,
    'RSM3_UPC-East': 258,
    'RSM4_UPC-NOR': 262,
    'RSM5_UPC-NOE1': 225,
    'RSM6_UPC-NOE2': 224,
    'RSM7_UPC-CEW': 324,
    'RSM8_UPC-SOU': 199
  };
  
  const correctTotal = Object.values(correctData).reduce((sum, val) => sum + val, 0);
  
  try {
    const url = 'https://supabase-registration.vercel.app/api/chart/rsm-provider';
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    
    console.log('\n📊 เปรียบเทียบแต่ละ RSM (WW-Provider):');
    console.log('='.repeat(120));
    console.log('┌─────────────────┬──────────────┬──────────────┬──────────────┬────────────┐');
    console.log('│ RSM             │ จากตาราง    │  จาก API     │  ส่วนต่าง    │  สถานะ     │');
    console.log('├─────────────────┼──────────────┼──────────────┼──────────────┼────────────┤');
    
    let totalFromAPI = 0;
    let totalDiff = 0;
    let allMatch = true;
    
    Object.keys(correctData).forEach(rsm => {
      const correct = correctData[rsm];
      const fromAPI = data.chartData?.find(item => item.rsm === rsm)?.['WW-Provider'] || 0;
      const diff = fromAPI - correct;
      totalFromAPI += fromAPI;
      totalDiff += Math.abs(diff);
      
      if (diff !== 0) allMatch = false;
      
      const status = diff === 0 ? '✅ ถูกต้อง' : 
                     diff > 0 ? `❌ เกิน ${diff}` : 
                     `❌ ขาด ${Math.abs(diff)}`;
      
      const highlight = diff !== 0 ? '\x1b[43m\x1b[30m' : '';
      const reset = diff !== 0 ? '\x1b[0m' : '';
      
      console.log(`│ ${rsm.padEnd(15)} │ ${String(correct).padStart(12)} │ ${highlight}${String(fromAPI).padStart(12)}${reset} │ ${String(diff > 0 ? '+' + diff : diff).padStart(12)} │ ${status.padEnd(14)} │`);
    });
    
    console.log('├─────────────────┼──────────────┼──────────────┼──────────────┼────────────┤');
    console.log(`│ \x1b[1mรวมทั้งหมด\x1b[0m      │ ${String(correctTotal).padStart(12)} │ \x1b[43m\x1b[30m${String(totalFromAPI).padStart(12)}\x1b[0m │ ${String(totalFromAPI - correctTotal > 0 ? '+' : '') + (totalFromAPI - correctTotal)}.padStart(12)} │ ${(allMatch ? '✅ ถูกต้อง' : '❌ ผิด').padEnd(14)} │`);
    console.log('└─────────────────┴──────────────┴──────────────┴──────────────┴────────────┘');
    
    console.log('\n📈 สรุป:');
    console.log('='.repeat(120));
    console.log(`จำนวนที่ถูกต้อง (จากตารางของคุณ):  ${correctTotal.toLocaleString()} คน`);
    console.log(`จำนวนจาก API (Production):          ${totalFromAPI.toLocaleString()} คน`);
    console.log(`ส่วนต่างรวม:                         ${Math.abs(totalFromAPI - correctTotal).toLocaleString()} คน`);
    console.log(`จำนวน RSM ที่ไม่ตรงกัน:              ${Object.keys(correctData).filter(rsm => {
      const fromAPI = data.chartData?.find(item => item.rsm === rsm)?.['WW-Provider'] || 0;
      return fromAPI !== correctData[rsm];
    }).length} / ${Object.keys(correctData).length} RSM`);
    
    if (allMatch) {
      console.log('\n✅ ข้อมูลทุก RSM ถูกต้องแล้ว!');
    } else {
      console.log('\n❌ ข้อมูลยังไม่ถูกต้อง มีความเป็นไปได้ 3 กรณี:');
      console.log('   1. ตารางที่คุณดูมาจาก Excel/ระบบอื่น ไม่ใช่จาก Supabase โดยตรง');
      console.log('   2. มีการ import ข้อมูลใหม่หลังจากที่คุณส่งตารางมา');
      console.log('   3. API นับข้อมูลไม่ถูกวิธี (ต้องตรวจสอบ logic)');
    }
    
    // ตรวจสอบว่าตารางของคุณมีการนับ Installation + Repair อย่างไร
    console.log('\n🔍 การตรวจสอบเพิ่มเติม:');
    console.log('='.repeat(120));
    console.log('จากตารางของคุณ:');
    console.log('  Installation: 1,836 คน');
    console.log('  Repair:         259 คน');
    console.log('  รวม:          2,095 คน');
    console.log('');
    console.log('สังเกต: 1,836 + 259 = 2,095 ✅');
    console.log('นี่หมายความว่าในตารางของคุณ:');
    console.log('  - ไม่มีคนที่ทำทั้ง Installation และ Repair พร้อมกัน');
    console.log('  - หรือมีการนับ unique แล้ว');
    console.log('');
    console.log('💡 คำแนะนำ:');
    console.log('   กรุณาตรวจสอบว่าตารางที่คุณดูมาจากไหน');
    console.log('   ถ้ามาจาก Excel/Power BI อาจมีการคำนวณที่ต่างจาก Supabase');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

compareWithCorrectData();
