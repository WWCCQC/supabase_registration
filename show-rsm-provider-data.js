// เรียก API โดยตรงเพื่อดูข้อมูล RSM Provider Distribution
async function fetchAndDisplayRSMData() {
  console.log('📊 ดึงข้อมูล RSM Provider Distribution');
  console.log('='.repeat(120));
  
  try {
    // เรียก production API
    const url = 'https://supabase-registration.vercel.app/api/chart/rsm-provider';
    console.log('\n📡 กำลังเรียก API:', url);
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('\n✅ ได้ข้อมูลแล้ว!\n');
    
    // แสดง Summary
    console.log('📈 Summary (ตัวเลขที่แสดงด้านบนกราฟ):');
    console.log('='.repeat(120));
    
    if (data.summary) {
      data.summary.providerBreakdown?.forEach(p => {
        const emoji = p.provider === 'WW-Provider' ? '🎯' : 
                      p.provider === 'True Tech' ? '📱' : '🏪';
        const highlight = p.provider === 'WW-Provider' ? '\x1b[43m\x1b[30m\x1b[1m' : '';
        const reset = p.provider === 'WW-Provider' ? '\x1b[0m' : '';
        console.log(`${emoji} ${p.provider.padEnd(20)}: ${highlight}${p.count.toLocaleString().padStart(6)}${reset} คน (${p.percentage}%)`);
      });
    }
    
    // แสดงตารางข้อมูลแต่ละ RSM
    console.log('\n📊 ข้อมูลแต่ละ RSM (ตรงกับตารางในรูป):');
    console.log('='.repeat(120));
    console.log('┌─────────────────┬──────────────┬──────────────┬──────────────┬────────┐');
    console.log('│ RSM             │  เถ้าแก่เทค  │  True Tech   │ WW-Provider  │  รวม   │');
    console.log('├─────────────────┼──────────────┼──────────────┼──────────────┼────────┤');
    
    let totalWW = 0;
    let totalTT = 0;
    let totalTG = 0;
    let grandTotal = 0;
    
    if (data.chartData) {
      // Sort by total descending
      const sortedData = [...data.chartData].sort((a, b) => b.total - a.total);
      
      sortedData.forEach(item => {
        const ww = item['WW-Provider'] || 0;
        const tt = item['True Tech'] || 0;
        const tg = item['เถ้าแก่เทค'] || 0;
        const total = item.total || 0;
        
        totalWW += ww;
        totalTT += tt;
        totalTG += tg;
        grandTotal += total;
        
        console.log(`│ ${item.rsm.padEnd(15)} │ ${String(tg).padStart(12)} │ ${String(tt).padStart(12)} │ \x1b[43m\x1b[30m${String(ww).padStart(12)}\x1b[0m │ ${String(total).padStart(6)} │`);
      });
      
      console.log('├─────────────────┼──────────────┼──────────────┼──────────────┼────────┤');
      console.log(`│ \x1b[1mผลรวม\x1b[0m           │ ${String(totalTG).padStart(12)} │ ${String(totalTT).padStart(12)} │ \x1b[43m\x1b[30m\x1b[1m${String(totalWW).padStart(12)}\x1b[0m │ ${String(grandTotal).padStart(6)} │`);
      console.log('└─────────────────┴──────────────┴──────────────┴──────────────┴────────┘');
    }
    
    // เปรียบเทียบ
    console.log('\n🔍 เปรียบเทียบกับตารางในรูป:');
    console.log('='.repeat(120));
    
    const expectedWW = 2095;
    const currentWW = totalWW;
    
    console.log(`จากตารางในรูป (highlight สีเหลือง):  ${expectedWW.toLocaleString()} คน`);
    console.log(`จาก API (ข้อมูลปัจจุบัน):             ${currentWW.toLocaleString()} คน`);
    console.log(`ความแตกต่าง:                          ${Math.abs(expectedWW - currentWW).toLocaleString()} คน`);
    
    if (currentWW === expectedWW) {
      console.log('\n✅ ตรงกัน! ข้อมูลถูกต้องแล้ว');
    } else if (currentWW === 2086) {
      console.log('\n❌ ยังเป็น 2,086 อยู่ (ต้องรอ Vercel deploy)');
    } else {
      console.log(`\n⚠️  ได้ค่า ${currentWW.toLocaleString()} ซึ่งไม่ตรงกับทั้ง 2 กรณี`);
    }
    
    // แสดงรายละเอียด WW-Provider แต่ละ RSM
    console.log('\n📋 รายละเอียด WW-Provider แต่ละ RSM:');
    console.log('='.repeat(120));
    
    if (data.chartData) {
      const sortedData = [...data.chartData].sort((a, b) => b['WW-Provider'] - a['WW-Provider']);
      
      sortedData.forEach((item, index) => {
        const ww = item['WW-Provider'] || 0;
        const emoji = index < 3 ? '🥇🥈🥉'[index] : '  ';
        console.log(`${emoji} ${(index + 1).toString().padStart(2)}. ${item.rsm.padEnd(20)}: ${String(ww).padStart(4)} คน`);
      });
    }
    
    console.log('\n' + '='.repeat(120));
    console.log('💡 หมายเหตุ:');
    console.log('   - ตัวเลขสีเหลือง = WW-Provider รวม (ตรงกับคอลัมน์สีเหลืองในรูป)');
    console.log('   - การนับใช้ unique national_id (ไม่นับซ้ำ)');
    console.log('   - รวมทั้ง Installation และ Repair');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 ลองใช้ local API แทน:');
    console.log('   1. เปิด terminal ใหม่');
    console.log('   2. รัน: npm run dev');
    console.log('   3. แก้ไข URL ในสคริปต์เป็น http://localhost:3000/api/chart/rsm-provider');
  }
}

fetchAndDisplayRSMData();
