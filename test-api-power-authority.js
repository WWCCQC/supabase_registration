// ตรวจสอบ response จาก API rsm-workgroup
const fetch = require('node-fetch');

async function checkAPIResponse() {
  console.log('🔍 กำลังเรียก API /api/chart/rsm-workgroup?forceRefresh=true...\n');

  try {
    const response = await fetch('http://localhost:3000/api/chart/rsm-workgroup?forceRefresh=true');
    const data = await response.json();

    console.log('📊 API Response Summary:');
    console.log(JSON.stringify(data.summary, null, 2));

    console.log('\n📊 ข้อมูล Power Authority จาก API:');
    console.log(`  - totalYes: ${data.summary.totalYes}`);
    console.log(`  - totalNo: ${data.summary.totalNo}`);
    console.log(`  - รวม: ${data.summary.totalYes + data.summary.totalNo}`);
    
    console.log('\n📊 เปรียบเทียบกับหน้าเว็บ:');
    console.log(`  หน้าเว็บแสดง: Yes: 400, No: 2,536`);
    console.log(`  API ส่งกลับ: Yes: ${data.summary.totalYes}, No: ${data.summary.totalNo}`);
    
    if (data.summary.totalNo !== 2534) {
      console.log(`\n❌ พบความไม่ตรงกัน! API ส่ง No=${data.summary.totalNo} แต่ควรเป็น 2534`);
    } else {
      console.log('\n✅ ตรงกับฐานข้อมูล!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 หมายเหตุ: ต้อง start dev server ก่อน (npm run dev)');
  }
}

checkAPIResponse();
