// Test script to verify power_authority data from Supabase
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function testPowerAuthority() {
  console.log('🔍 Testing Power Authority Data...\n');

  try {
    // 1. ตรวจสอบว่ามีคอลัมน์ power_authority หรือไม่
    console.log('1️⃣ Checking if power_authority column exists...');
    const { data: sample, error: sampleError } = await supabase
      .from('technicians')
      .select('tech_id, rsm, power_authority, workgroup_status, national_id')
      .limit(5);

    if (sampleError) {
      console.error('❌ Error:', sampleError.message);
      return;
    }

    console.log('✅ Sample data (first 5 rows):');
    console.table(sample);

    // 2. นับจำนวนแต่ละค่าใน power_authority
    console.log('\n2️⃣ Counting power_authority values...');
    const { data: allData, error: allError } = await supabase
      .from('technicians')
      .select('power_authority, national_id, rsm');

    if (allError) {
      console.error('❌ Error:', allError.message);
      return;
    }

    // วิเคราะห์ข้อมูล
    const stats = {
      total: allData.length,
      yes: 0,
      no: 0,
      empty: 0,
      null: 0,
      other: {},
      uniqueNationalIds: new Set(),
      withRsm: 0,
      withoutRsm: 0
    };

    allData.forEach(row => {
      const pa = row.power_authority;
      const nationalId = row.national_id;
      const rsm = row.rsm;

      // นับ unique national_id
      if (nationalId) {
        stats.uniqueNationalIds.add(nationalId);
      }

      // นับ RSM
      if (rsm && rsm.trim() !== '') {
        stats.withRsm++;
      } else {
        stats.withoutRsm++;
      }

      if (!pa || pa === null) {
        stats.null++;
      } else {
        const cleaned = String(pa).toLowerCase().trim();
        if (cleaned === 'yes' || cleaned === 'y') {
          stats.yes++;
        } else if (cleaned === 'no' || cleaned === 'n') {
          stats.no++;
        } else if (cleaned === '') {
          stats.empty++;
        } else {
          stats.other[cleaned] = (stats.other[cleaned] || 0) + 1;
        }
      }
    });

    console.log('\n📊 Statistics:');
    console.log(`Total records: ${stats.total}`);
    console.log(`Unique national_ids: ${stats.uniqueNationalIds.size}`);
    console.log(`Records with RSM: ${stats.withRsm}`);
    console.log(`Records without RSM: ${stats.withoutRsm}`);
    console.log(`\nPower Authority breakdown:`);
    console.log(`  - Yes: ${stats.yes} (${(stats.yes / stats.total * 100).toFixed(2)}%)`);
    console.log(`  - No: ${stats.no} (${(stats.no / stats.total * 100).toFixed(2)}%)`);
    console.log(`  - Empty: ${stats.empty} (${(stats.empty / stats.total * 100).toFixed(2)}%)`);
    console.log(`  - Null: ${stats.null} (${(stats.null / stats.total * 100).toFixed(2)}%)`);
    
    if (Object.keys(stats.other).length > 0) {
      console.log(`  - Other values:`);
      Object.entries(stats.other).forEach(([key, count]) => {
        console.log(`    • "${key}": ${count}`);
      });
    }

    // 3. ตรวจสอบข้อมูล workgroup_status เพื่อเปรียบเทียบ
    console.log('\n3️⃣ Comparing with workgroup_status...');
    const { data: compareData, error: compareError } = await supabase
      .from('technicians')
      .select('power_authority, workgroup_status, national_id')
      .limit(10);

    if (!compareError) {
      console.log('✅ Sample comparison (first 10 rows):');
      console.table(compareData);
    }

    // 4. ตรวจสอบข้อมูลตาม RSM
    console.log('\n4️⃣ Checking data by RSM (top 5)...');
    const { data: rsmData, error: rsmError } = await supabase
      .from('technicians')
      .select('rsm, power_authority, national_id')
      .not('rsm', 'is', null)
      .not('rsm', 'eq', '');

    if (!rsmError) {
      // จัดกลุ่มตาม RSM
      const rsmGroups = {};
      rsmData.forEach(row => {
        const rsm = String(row.rsm || '').trim();
        const pa = String(row.power_authority || '').toLowerCase().trim();
        const nationalId = String(row.national_id || '').trim();

        if (!rsm || !nationalId) return;

        if (!rsmGroups[rsm]) {
          rsmGroups[rsm] = {
            yes: new Set(),
            no: new Set()
          };
        }

        if (pa === 'yes' || pa === 'y') {
          rsmGroups[rsm].yes.add(nationalId);
        } else if (pa === 'no' || pa === 'n') {
          rsmGroups[rsm].no.add(nationalId);
        }
      });

      // แสดง top 5 RSM
      const topRsm = Object.entries(rsmGroups)
        .map(([rsm, counts]) => ({
          rsm,
          yes: counts.yes.size,
          no: counts.no.size,
          total: counts.yes.size + counts.no.size
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      console.log('✅ Top 5 RSM by total technicians:');
      console.table(topRsm);
    }

    // 5. ทดสอบเรียก API endpoint
    console.log('\n5️⃣ Testing API endpoint (if server is running)...');
    try {
      const response = await fetch('http://localhost:3001/api/chart/rsm-workgroup');
      if (response.ok) {
        const apiData = await response.json();
        console.log('✅ API Response Summary:');
        console.log(apiData.summary);
        console.log(`\nChart data (top 5):`);
        console.table(apiData.chartData.slice(0, 5));
      } else {
        console.log('⚠️ API endpoint not available (server may not be running)');
      }
    } catch (e) {
      console.log('⚠️ Cannot test API endpoint:', e.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPowerAuthority().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
});
