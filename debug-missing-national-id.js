/**
 * ตรวจสอบข้อมูลที่ไม่มี national_id
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMissingNationalId() {
  console.log('🔍 ตรวจสอบข้อมูลที่ไม่มี national_id...\n');

  // นับข้อมูลที่ไม่มี national_id
  const { count: missingCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .or('national_id.is.null,national_id.eq.');
  
  console.log(`❌ จำนวนข้อมูลที่ไม่มี national_id: ${missingCount} รายการ\n`);

  if (missingCount > 0) {
    // ดึงข้อมูลที่ไม่มี national_id
    const { data } = await supabase
      .from('technicians')
      .select('tech_id, full_name, work_type, provider, rsm, national_id')
      .or('national_id.is.null,national_id.eq.')
      .limit(20);
    
    console.log(`📋 ข้อมูลที่ไม่มี national_id (แสดง ${Math.min(20, missingCount)} รายการ):\n`);
    data.forEach((row, idx) => {
      console.log(`${idx + 1}. tech_id: ${row.tech_id}`);
      console.log(`   full_name: ${row.full_name}`);
      console.log(`   work_type: ${row.work_type || 'N/A'}`);
      console.log(`   provider: ${row.provider || 'N/A'}`);
      console.log(`   rsm: ${row.rsm || 'N/A'}`);
      console.log(`   national_id: ${row.national_id || 'NULL'}`);
      console.log('');
    });
  }

  // นับข้อมูลที่มี national_id
  const { count: withIdCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .not('national_id', 'is', null)
    .not('national_id', 'eq', '');
  
  console.log(`✅ จำนวนข้อมูลที่มี national_id: ${withIdCount} รายการ`);
  
  // นับข้อมูลทั้งหมด
  const { count: totalCount } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 จำนวนข้อมูลทั้งหมด: ${totalCount} รายการ`);
  console.log(`\n📊 สรุป: ${withIdCount} + ${missingCount} = ${withIdCount + missingCount}`);
  
  if (missingCount === 18) {
    console.log('\n✅ นี่คือสาเหตุที่ API แสดง 2,916 แทนที่จะเป็น 2,934!');
    console.log('   API กำลัง filter ข้อมูลที่ไม่มี national_id ออก');
  }
}

checkMissingNationalId();
