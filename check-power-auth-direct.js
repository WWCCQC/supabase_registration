const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPowerAuthority() {
  console.log('🔍 กำลังตรวจสอบข้อมูล Power Authority Status จาก Supabase...\n');

  try {
    // นับจำนวน Yes (รวม Y)
    console.log('⏳ กำลังนับจำนวน Yes...');
    let yesData = [];
    let yesFrom = 0;
    let yesHasMore = true;
    
    while (yesHasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("national_id, power_authority")
        .or('power_authority.ilike.Yes,power_authority.ilike.Y')
        .range(yesFrom, yesFrom + 999);
      
      if (error) {
        console.error("❌ Error counting Yes:", error);
        break;
      }
      
      if (data && data.length > 0) {
        yesData = [...yesData, ...data];
        yesFrom += 1000;
        yesHasMore = data.length === 1000;
      } else {
        yesHasMore = false;
      }
    }
    
    const dbYesCount = new Set(yesData.map(r => String(r.national_id).trim())).size;
    console.log(`✅ Yes: ${dbYesCount} คน (fetched ${yesData.length} records)`);

    // นับจำนวน No (รวม N)
    console.log('⏳ กำลังนับจำนวน No...');
    let noData = [];
    let noFrom = 0;
    let noHasMore = true;
    
    while (noHasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select("national_id, power_authority")
        .or('power_authority.ilike.No,power_authority.ilike.N')
        .range(noFrom, noFrom + 999);
      
      if (error) {
        console.error("❌ Error counting No:", error);
        break;
      }
      
      if (data && data.length > 0) {
        noData = [...noData, ...data];
        noFrom += 1000;
        noHasMore = data.length === 1000;
      } else {
        noHasMore = false;
      }
    }
    
    const dbNoCount = new Set(noData.map(r => String(r.national_id).trim())).size;
    console.log(`✅ No: ${dbNoCount} คน (fetched ${noData.length} records)`);

    // นับจำนวนทั้งหมด
    const { count: totalCount, error: totalError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Error counting total:', totalError);
      return;
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 สรุปผลการตรวจสอบ Power Authority Status');
    console.log('═'.repeat(60));
    console.log(`🟢 Yes:  ${dbYesCount.toLocaleString()} คน (${((dbYesCount / totalCount) * 100).toFixed(2)}%)`);
    console.log(`🔴 No:   ${dbNoCount.toLocaleString()} คน (${((dbNoCount / totalCount) * 100).toFixed(2)}%)`);
    console.log('─'.repeat(60));
    console.log(`📊 รวม Yes+No: ${(dbYesCount + dbNoCount).toLocaleString()} คน`);
    console.log(`📊 จำนวนช่างทั้งหมด: ${totalCount.toLocaleString()} คน`);
    console.log('═'.repeat(60));

    // ตรวจสอบค่าอื่นๆ
    const otherCount = totalCount - (dbYesCount + dbNoCount);
    if (otherCount > 0) {
      console.log(`\n⚠️  มีข้อมูล ${otherCount} คน ที่ไม่ใช่ Yes หรือ No (อาจเป็น NULL หรือค่าอื่น)`);
    }

    // แสดงตัวอย่างค่า Yes และ No
    console.log('\n📋 ตัวอย่างค่า Power Authority:');
    console.log('─'.repeat(60));
    
    const yesValues = [...new Set(yesData.map(r => r.power_authority))];
    console.log(`🟢 ค่าที่นับเป็น Yes: ${yesValues.join(', ')}`);
    
    const noValues = [...new Set(noData.map(r => r.power_authority))];
    console.log(`🔴 ค่าที่นับเป็น No: ${noValues.join(', ')}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPowerAuthority();
