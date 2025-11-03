const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPowerAuthorityStatus() {
  console.log('🔍 กำลังตรวจสอบข้อมูล Power Authority Status จาก Supabase...\n');

  try {
    // นับจำนวนทั้งหมด
    const { count: totalCount, error: totalError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Error counting total:', totalError);
      return;
    }

    console.log(`📊 จำนวนช่างทั้งหมด: ${totalCount} คน`);
    console.log('─'.repeat(50));

    // นับจำนวน Yes
    const { count: yesCount, error: yesError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('power_authority', 'Yes');

    if (yesError) {
      console.error('❌ Error counting Yes:', yesError);
      return;
    }

    // นับจำนวน No
    const { count: noCount, error: noError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('power_authority', 'No');

    if (noError) {
      console.error('❌ Error counting No:', noError);
      return;
    }

    // นับจำนวน NULL หรือค่าอื่นๆ
    const { count: nullCount, error: nullError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .is('power_authority', null);

    if (nullError) {
      console.error('❌ Error counting NULL:', nullError);
      return;
    }

    console.log('\n✅ ผลการตรวจสอบ Power Authority Status:');
    console.log('─'.repeat(50));
    console.log(`🟢 Yes:  ${yesCount} คน (${((yesCount / totalCount) * 100).toFixed(2)}%)`);
    console.log(`🔴 No:   ${noCount} คน (${((noCount / totalCount) * 100).toFixed(2)}%)`);
    console.log(`⚪ NULL: ${nullCount} คน (${((nullCount / totalCount) * 100).toFixed(2)}%)`);
    console.log('─'.repeat(50));
    console.log(`📊 รวม:  ${yesCount + noCount + nullCount} คน`);

    // ตรวจสอบว่าผลรวมตรงกับจำนวนทั้งหมดไหม
    const sum = yesCount + noCount + nullCount;
    if (sum !== totalCount) {
      console.log(`\n⚠️  คำเตือน: ผลรวม (${sum}) ไม่ตรงกับจำนวนทั้งหมด (${totalCount})`);
      console.log(`   ส่วนต่าง: ${totalCount - sum} คน`);
      
      // ตรวจสอบค่าอื่นๆ ที่ไม่ใช่ Yes, No, NULL
      const { data: otherData, error: otherError } = await supabase
        .from('technicians')
        .select('power_authority')
        .not('power_authority', 'eq', 'Yes')
        .not('power_authority', 'eq', 'No')
        .not('power_authority', 'is', null);

      if (!otherError && otherData && otherData.length > 0) {
        console.log('\n🔍 ค่าอื่นๆ ที่พบ:');
        const uniqueValues = [...new Set(otherData.map(item => item.power_authority))];
        uniqueValues.forEach(value => {
          const count = otherData.filter(item => item.power_authority === value).length;
          console.log(`   - "${value}": ${count} คน`);
        });
      }
    } else {
      console.log('\n✅ ผลรวมถูกต้อง!');
    }

    // ดึงตัวอย่างข้อมูล
    console.log('\n📋 ตัวอย่างข้อมูล (5 รายการแรก):');
    console.log('─'.repeat(50));
    
    const { data: sampleData, error: sampleError } = await supabase
      .from('technicians')
      .select('national_id, full_name, power_authority, rsm')
      .limit(5);

    if (!sampleError && sampleData) {
      sampleData.forEach((item, index) => {
        console.log(`${index + 1}. ${item.full_name || 'N/A'}`);
        console.log(`   Power Authority: ${item.power_authority || 'NULL'}`);
        console.log(`   RSM: ${item.rsm || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPowerAuthorityStatus();
