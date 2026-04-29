// Test local API endpoint
async function testCTMProviderAPI() {
  console.log('🔍 ตรวจสอบความแตกต่างของ WW-Provider จาก API Endpoint\n');
  console.log('='.repeat(80));
  
  try {
    const localUrl = 'http://localhost:3000/api/chart/ctm-provider';
    
    console.log('📡 กำลังเรียก API:', localUrl);
    console.log('-'.repeat(80));
    
    const response = await fetch(localUrl, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('\n📊 ผลลัพธ์จาก API:');
    console.log('='.repeat(80));
    
    // แสดง Summary
    if (data.summary) {
      console.log('\n📈 Summary (ตัวเลขด้านบน - ใช้การนับโดยตรง):');
      console.log('-'.repeat(80));
      console.log(`Total CTMs: ${data.summary.totalCtms}`);
      console.log(`Total Technicians: ${data.summary.totalTechnicians.toLocaleString()}`);
      console.log('\nProvider Breakdown:');
      data.summary.providerBreakdown?.forEach(p => {
        const emoji = p.provider === 'WW-Provider' ? '🎯' : 
                      p.provider === 'True Tech' ? '📱' : '🏪';
        console.log(`${emoji} ${p.provider.padEnd(20)}: ${p.count.toLocaleString()} (${p.percentage}%)`);
      });
    }
    
    // คำนวณจากกราฟ
    console.log('\n📊 ข้อมูลจากกราฟ (รวม unique national_id):');
    console.log('-'.repeat(80));
    
    const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
    const chartTotals = {};
    
    providers.forEach(provider => {
      let total = 0;
      data.chartData?.forEach(ctm => {
        total += ctm[provider] || 0;
      });
      chartTotals[provider] = total;
    });
    
    providers.forEach(provider => {
      const emoji = provider === 'WW-Provider' ? '🎯' : 
                    provider === 'True Tech' ? '📱' : '🏪';
      console.log(`${emoji} ${provider.padEnd(20)}: ${chartTotals[provider].toLocaleString()}`);
    });
    
    const totalFromChart = Object.values(chartTotals).reduce((sum, count) => sum + count, 0);
    console.log(`\nรวมทั้งหมดจากกราฟ: ${totalFromChart.toLocaleString()}`);
    
    // เปรียบเทียบ
    console.log('\n🔍 การเปรียบเทียบ:');
    console.log('='.repeat(80));
    
    providers.forEach(provider => {
      const summaryCount = data.summary.providerBreakdown?.find(p => p.provider === provider)?.count || 0;
      const chartCount = chartTotals[provider];
      const diff = summaryCount - chartCount;
      
      console.log(`\n${provider}:`);
      console.log(`  Summary (นับโดยตรง):           ${summaryCount.toLocaleString()}`);
      console.log(`  กราฟ (unique national_id):     ${chartCount.toLocaleString()}`);
      if (diff !== 0) {
        console.log(`  ❌ ความแตกต่าง:                 ${diff.toLocaleString()} records`);
      } else {
        console.log(`  ✅ ตรงกัน`);
      }
    });
    
    // แสดง Top 10 CTMs
    console.log('\n📊 Top 10 CTMs:');
    console.log('='.repeat(80));
    data.chartData?.slice(0, 10).forEach((ctm, i) => {
      const wwCount = ctm['WW-Provider'] || 0;
      const ttCount = ctm['True Tech'] || 0;
      const tgCount = ctm['เถ้าแก่เทค'] || 0;
      console.log(`${i + 1}. ${ctm.ctm.padEnd(30)} Total: ${ctm.total.toLocaleString().padStart(5)} (WW: ${wwCount.toLocaleString().padStart(4)}, TT: ${ttCount.toLocaleString().padStart(3)}, TG: ${tgCount.toLocaleString().padStart(2)})`);
    });
    
    // สรุปปัญหา
    console.log('\n💡 สรุปปัญหา:');
    console.log('='.repeat(80));
    
    const wwSummary = data.summary.providerBreakdown?.find(p => p.provider === 'WW-Provider')?.count || 0;
    const wwChart = chartTotals['WW-Provider'];
    const wwDiff = wwSummary - wwChart;
    
    if (wwDiff > 0) {
      console.log(`❌ WW-Provider แสดงค่าไม่ตรงกัน:`);
      console.log(`   - Summary แสดง: ${wwSummary.toLocaleString()}`);
      console.log(`   - กราฟแสดง:     ${wwChart.toLocaleString()}`);
      console.log(`   - ส่วนต่าง:      ${wwDiff.toLocaleString()} records`);
      console.log(`\n🔧 สาเหตุที่เป็นไปได้:`);
      console.log(`   1. มี ${wwDiff} records ที่ไม่มี national_id ถูกกรองออกจากกราฟ`);
      console.log(`   2. หรือมี national_id ซ้ำที่ถูกรวมเป็น unique ในกราฟ`);
      
      console.log(`\n💡 วิธีแก้ไข:`);
      console.log(`   ตัวเลือก 1: แก้ API ให้ใช้ค่า unique national_id ทั้ง summary และกราฟ`);
      console.log(`   ตัวเลือก 2: แก้ API ให้ใช้การนับโดยตรงทั้ง summary และกราฟ`);
      console.log(`   แนะนำ: ตัวเลือก 1 เพราะนับเฉพาะคนที่มี national_id ที่ถูกต้อง`);
    } else {
      console.log(`✅ WW-Provider แสดงค่าตรงกันแล้ว!`);
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 กรุณาตรวจสอบ:');
    console.log('   1. Next.js server กำลังรันอยู่หรือไม่? (npm run dev)');
    console.log('   2. API endpoint ถูกต้องหรือไม่?');
    console.log('   3. ลอง refresh browser และเรียก API ใหม่');
  }
}

testCTMProviderAPI();
