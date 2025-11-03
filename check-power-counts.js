// ตรวจสอบ Power Authority counts จาก DB โดยตรง
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getPowerAuthorityCounts() {
  console.log('🔍 กำลัง Query ข้อมูลจาก Supabase...\n');

  // Count Yes records with same filters as API
  const { count: yesCount, error: yesError } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .not('rsm', 'is', null)
    .not('provider_name', 'is', null)
    .not('work_type', 'is', null)
    .ilike('power_authority', 'Yes');

  // Count No records with same filters as API
  const { count: noCount, error: noError } = await supabase
    .from('technicians')
    .select('*', { count: 'exact', head: true })
    .not('rsm', 'is', null)
    .not('provider_name', 'is', null)
    .not('work_type', 'is', null)
    .ilike('power_authority', 'No');

  if (yesError || noError) {
    console.error('Error:', yesError || noError);
    return;
  }

  console.log('📊 จำนวนข้อมูลจาก Database (with filters):');
  console.log(`  - Yes: ${yesCount} records`);
  console.log(`  - No: ${noCount} records`);
  console.log(`  - Total: ${yesCount + noCount} records`);

  console.log('\n📊 เปรียบเทียบกับหน้าเว็บ:');
  console.log(`  หน้าเว็บแสดง: Yes: 400, No: 2,536 (Total: 2,936)`);
  console.log(`  Database มี: Yes: ${yesCount}, No: ${noCount} (Total: ${yesCount + noCount})`);
  
  const yesDiff = 400 - yesCount;
  const noDiff = 2536 - noCount;
  
  console.log('\n📊 ความแตกต่าง:');
  console.log(`  - Yes: ${yesDiff > 0 ? '+' : ''}${yesDiff}`);
  console.log(`  - No: ${noDiff > 0 ? '+' : ''}${noDiff}`);

  if (yesDiff !== 0 || noDiff !== 0) {
    console.log('\n❌ ข้อมูลไม่ตรงกัน! ต้องแก้ไข API');
  } else {
    console.log('\n✅ ข้อมูลตรงกัน!');
  }
}

getPowerAuthorityCounts().catch(console.error);
