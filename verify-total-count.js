const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTotalCount() {
  console.log('🔍 กำลังตรวจสอบจำนวนช่างทั้งหมดจาก Supabase...\n');

  try {
    // วิธีที่ 1: นับทั้งหมดด้วย count
    console.log('📊 วิธีที่ 1: ใช้ count query');
    const { count: totalCount, error: countError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error:', countError);
    } else {
      console.log(`   จำนวนทั้งหมด: ${totalCount?.toLocaleString()} คน`);
    }

    // วิธีที่ 2: Fetch ทั้งหมดแล้วนับ
    console.log('\n📊 วิธีที่ 2: Fetch ข้อมูลทั้งหมดแล้วนับ');
    let allData = [];
    let from = 0;
    let hasMore = true;
    let batchCount = 0;

    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('tech_id, national_id, power_authority')
        .order('tech_id', { ascending: true })
        .range(from, from + 999);
      
      if (error) {
        console.error('❌ Error fetching data:', error);
        break;
      }
      
      if (data && data.length > 0) {
        batchCount++;
        allData = [...allData, ...data];
        console.log(`   Batch ${batchCount}: ${data.length} records, รวม: ${allData.length}`);
        from += 1000;
        hasMore = data.length === 1000;
      } else {
        hasMore = false;
      }
    }

    console.log(`\n   จำนวนที่ fetch ได้: ${allData.length.toLocaleString()} คน`);

    // นับ Power Authority
    const yesCount = allData.filter(r => {
      const pa = r.power_authority;
      return pa && (pa.toLowerCase() === 'yes' || pa.toLowerCase() === 'y');
    }).length;

    const noCount = allData.filter(r => {
      const pa = r.power_authority;
      return pa && (pa.toLowerCase() === 'no' || pa.toLowerCase() === 'n');
    }).length;

    const nullCount = allData.filter(r => !r.power_authority).length;
    const otherCount = allData.length - yesCount - noCount - nullCount;

    console.log('\n📊 วิธีที่ 3: นับ Power Authority แยกตามค่า');
    console.log('═'.repeat(60));
    console.log(`🟢 Yes:  ${yesCount.toLocaleString()} คน`);
    console.log(`🔴 No:   ${noCount.toLocaleString()} คน`);
    console.log(`⚪ NULL: ${nullCount.toLocaleString()} คน`);
    if (otherCount > 0) {
      console.log(`❓ อื่นๆ: ${otherCount.toLocaleString()} คน`);
    }
    console.log('─'.repeat(60));
    console.log(`📊 รวม:  ${(yesCount + noCount + nullCount + otherCount).toLocaleString()} คน`);
    console.log('═'.repeat(60));

    // แสดงตัวอย่างค่าที่ไม่ใช่ Yes/No/NULL
    if (otherCount > 0) {
      const otherValues = allData
        .filter(r => {
          const pa = r.power_authority;
          if (!pa) return false;
          const paLower = pa.toLowerCase();
          return paLower !== 'yes' && paLower !== 'y' && paLower !== 'no' && paLower !== 'n';
        })
        .map(r => r.power_authority);
      
      const uniqueOther = [...new Set(otherValues)];
      console.log('\n🔍 ค่าอื่นๆ ที่พบ:');
      uniqueOther.forEach(val => {
        const count = otherValues.filter(v => v === val).length;
        console.log(`   "${val}": ${count} คน`);
      });
    }

    // เปรียบเทียบผลลัพธ์
    console.log('\n📊 สรุปการเปรียบเทียบ:');
    console.log('═'.repeat(60));
    console.log(`Count Query:     ${totalCount?.toLocaleString()} คน`);
    console.log(`Fetch All:       ${allData.length.toLocaleString()} คน`);
    console.log(`ส่วนต่าง:        ${totalCount ? (totalCount - allData.length).toLocaleString() : 'N/A'} คน`);
    console.log('═'.repeat(60));

    if (totalCount && totalCount !== allData.length) {
      console.log('\n⚠️  มีส่วนต่าง! อาจเป็นเพราะ:');
      console.log('   1. ปัญหา character encoding (อักขระพิเศษ)');
      console.log('   2. ข้อมูลถูกเพิ่ม/ลบระหว่างการ query');
      console.log('   3. ข้อจำกัดของ Supabase pagination');
    }

    // ตรวจสอบข้อมูลล่าสุด
    console.log('\n📋 ข้อมูลล่าสุด (tech_id สูงสุด 5 รายการ):');
    const { data: latestData, error: latestError } = await supabase
      .from('technicians')
      .select('tech_id, national_id, full_name, power_authority')
      .order('tech_id', { ascending: false })
      .limit(5);

    if (!latestError && latestData) {
      latestData.forEach((item, index) => {
        console.log(`${index + 1}. ID: ${item.tech_id} - ${item.full_name || 'N/A'}`);
        console.log(`   Power Authority: ${item.power_authority || 'NULL'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyTotalCount();
