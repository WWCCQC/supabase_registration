// ตรวจสอบข้อมูล Power Authority จาก API
async function checkPowerAuthorityFromAPI() {
  console.log('🔍 กำลังเรียก API เพื่อตรวจสอบข้อมูล Power Authority Status...\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/chart/rsm-workgroup?force=true');
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    console.log('✅ ผลการตรวจสอบจาก API:');
    console.log('─'.repeat(60));
    console.log(`🟢 Yes:  ${data.totalYes} คน`);
    console.log(`🔴 No:   ${data.totalNo} คน`);
    console.log(`📊 รวม:  ${data.totalYes + data.totalNo} คน`);
    console.log('─'.repeat(60));
    
    console.log('\n📋 ข้อมูล RSM:');
    console.log('─'.repeat(60));
    
    if (data.data && typeof data.data === 'object') {
      Object.keys(data.data).forEach(rsm => {
        const rsmData = data.data[rsm];
        const yes = rsmData['Yes'] || 0;
        const no = rsmData['No'] || 0;
        console.log(`${rsm}:`);
        console.log(`  Yes: ${yes}, No: ${no}, รวม: ${yes + no}`);
      });
    }
    
    console.log('\n💡 หมายเหตุ: ข้อมูลนี้มาจาก API ที่หน้าหลักใช้แสดงกราฟ');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 กรุณาตรวจสอบว่า Next.js dev server กำลังรันอยู่ที่ http://localhost:3001');
  }
}

checkPowerAuthorityFromAPI();
