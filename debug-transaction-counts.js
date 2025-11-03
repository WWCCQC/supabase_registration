// ตรวจสอบจำนวน transaction records จริงจาก Database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTransactionCounts() {
  console.log('🔍 เริ่มตรวจสอบจำนวน Transaction...\n');

  // 1. Get total count from DB
  const { count: totalCount, error: countError } = await supabase
    .from('transaction')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ เกิดข้อผิดพลาด:', countError);
    return;
  }

  console.log(`📊 จำนวน Transaction ทั้งหมดจาก DB: ${totalCount} records\n`);

  // 2. Fetch all data with pagination
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('transaction')
      .select('Register, Register_Ref, Year, Month, Week, Date, provider')
      .order('Date', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('❌ Error fetching batch:', error);
      break;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += pageSize;
      hasMore = data.length === pageSize;
      console.log(`📦 Fetched batch: ${data.length} records, total so far: ${allData.length}`);
    } else {
      hasMore = false;
    }
  }

  console.log(`\n📊 ดึงข้อมูลได้ทั้งหมด: ${allData.length} records`);
  console.log(`📊 เปรียบเทียบ: DB count = ${totalCount}, Fetched = ${allData.length}`);
  
  if (totalCount !== allData.length) {
    console.log(`\n⚠️  ความแตกต่าง: ${totalCount - allData.length} records\n`);
  } else {
    console.log('\n✅ จำนวนตรงกัน!\n');
  }

  // 3. Count by Register type
  console.log('📊 นับตามประเภท Register:');
  
  const registerCounts = {};
  allData.forEach(item => {
    const register = String(item.Register || '').trim();
    if (register) {
      registerCounts[register] = (registerCounts[register] || 0) + 1;
    }
  });

  Object.entries(registerCounts).forEach(([register, count]) => {
    console.log(`  "${register}": ${count} records`);
  });

  // 4. Count specifically "ช่างใหม่" and "ช่างลาออก"
  console.log('\n📊 นับตามเงื่อนไข (เหมือนในหน้าเว็บ):');
  
  const newTechs = allData.filter(item => {
    const register = String(item.Register || '');
    return register.includes('างใหม่'); // เช็คแบบ includes เหมือนในโค้ด
  }).length;
  
  const resignedTechs = allData.filter(item => {
    const register = String(item.Register || '');
    return register.includes('ช่างลาออก');
  }).length;
  
  console.log(`  ช่างใหม่ (includes 'างใหม่'): ${newTechs} คน`);
  console.log(`  ช่างลาออก (includes 'ช่างลาออก'): ${resignedTechs} คน`);
  console.log(`  การเปลี่ยนแปลงสุทธิ: ${newTechs - resignedTechs}`);
  console.log(`  รวม Transaction: ${newTechs + resignedTechs}`);

  // 5. Check for exact matches
  console.log('\n📊 นับแบบ exact match:');
  
  const exactNewTechs = allData.filter(item => {
    const register = String(item.Register || '').trim();
    return register === 'ช่างใหม่';
  }).length;
  
  const exactResignedTechs = allData.filter(item => {
    const register = String(item.Register || '').trim();
    return register === 'ช่างลาออก';
  }).length;
  
  console.log(`  ช่างใหม่ (exact 'ช่างใหม่'): ${exactNewTechs} คน`);
  console.log(`  ช่างลาออก (exact 'ช่างลาออก'): ${exactResignedTechs} คน`);
  console.log(`  การเปลี่ยนแปลงสุทธิ: ${exactNewTechs - exactResignedTechs}`);
  console.log(`  รวม Transaction: ${exactNewTechs + exactResignedTechs}`);

  // 6. Show sample records
  console.log('\n📋 ตัวอย่างข้อมูล 5 รายการแรก:');
  allData.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}. Register: "${item.Register}", Date: ${item.Date}, Provider: ${item.provider}`);
  });
}

checkTransactionCounts().catch(console.error);
