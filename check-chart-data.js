// ตรวจสอบข้อมูลจริงจาก Supabase สำหรับ RSM Power Authority Chart
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkChartData() {
  console.log('🔍 กำลังตรวจสอบข้อมูลกราฟ RSM Power Authority...\n');

  try {
    // 1. ดึงข้อมูลทั้งหมดแบบเดียวกับ API
    console.log('📥 กำลังดึงข้อมูลจาก Supabase...');
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('rsm, provider, power_authority, national_id')
        .order('tech_id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('❌ Error:', error);
        return;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ ดึงข้อมูลได้ ${allData.length} records\n`);

    // 2. ประมวลผลแบบเดียวกับ API
    const groupedData = {};
    const allNationalIds = new Set();
    const nationalIdsWithRsm = new Set();
    const nationalIdsWithAuthority = new Set();

    allData.forEach((row) => {
      const rsm = String(row.rsm || '').trim();
      const powerAuthority = String(row.power_authority || '').trim();
      const nationalId = String(row.national_id || '').trim();

      // ข้าม record ที่ไม่มี national_id
      if (!nationalId || nationalId === 'null' || nationalId === 'undefined') return;

      allNationalIds.add(nationalId);

      // นับข้อมูลที่มี RSM
      if (rsm && rsm !== 'null' && rsm !== 'undefined') {
        nationalIdsWithRsm.add(nationalId);
      }

      // นับข้อมูลที่มี power_authority
      if (powerAuthority && powerAuthority !== 'null' && powerAuthority !== 'undefined') {
        nationalIdsWithAuthority.add(nationalId);
      }

      // ข้ามถ้าไม่มี RSM (สำหรับ grouping)
      if (!rsm || rsm === 'null' || rsm === 'undefined') return;

      if (!groupedData[rsm]) {
        groupedData[rsm] = { Yes: new Set(), No: new Set() };
      }

      const cleanAuthority = powerAuthority.toLowerCase();

      if (cleanAuthority === 'yes' || cleanAuthority === 'y') {
        groupedData[rsm].Yes.add(nationalId);
      } else if (cleanAuthority === 'no' || cleanAuthority === 'n') {
        groupedData[rsm].No.add(nationalId);
      }
    });

    // 3. แสดงผลแบบตาราง
    console.log('📊 ตารางข้อมูลแยกตาม RSM:\n');
    console.log('┌────────────────────────┬──────────┬──────────┬──────────┐');
    console.log('│ RSM                    │   Yes    │   No     │  Total   │');
    console.log('├────────────────────────┼──────────┼──────────┼──────────┤');

    const chartData = Object.entries(groupedData)
      .map(([rsm, counts]) => ({
        rsm,
        Yes: counts.Yes.size,
        No: counts.No.size,
        total: counts.Yes.size + counts.No.size,
      }))
      .sort((a, b) => b.total - a.total);

    chartData.forEach((item) => {
      const rsmPadded = item.rsm.padEnd(22, ' ');
      const yesPadded = String(item.Yes).padStart(8, ' ');
      const noPadded = String(item.No).padStart(8, ' ');
      const totalPadded = String(item.total).padStart(8, ' ');
      console.log(`│ ${rsmPadded} │${yesPadded} │${noPadded} │${totalPadded} │`);
    });

    console.log('└────────────────────────┴──────────┴──────────┴──────────┘\n');

    // 4. คำนวณ Summary
    const totalYes = chartData.reduce((sum, item) => sum + item.Yes, 0);
    const totalNo = chartData.reduce((sum, item) => sum + item.No, 0);
    const totalWithRsm = totalYes + totalNo;

    console.log('📈 Summary (ยอดรวมทั้งหมด):');
    console.log('┌─────────────────────────────────┬──────────┐');
    console.log('│ รายการ                          │  จำนวน   │');
    console.log('├─────────────────────────────────┼──────────┤');
    console.log(`│ จำนวน RSM ทั้งหมด               │ ${String(Object.keys(groupedData).length).padStart(8)} │`);
    console.log(`│ จำนวน Technicians ทั้งหมด       │ ${String(allNationalIds.size).padStart(8)} │`);
    console.log(`│ จำนวน Technicians ที่มี RSM     │ ${String(nationalIdsWithRsm.size).padStart(8)} │`);
    console.log(`│ จำนวน Technicians ที่ไม่มี RSM  │ ${String(allNationalIds.size - nationalIdsWithRsm.size).padStart(8)} │`);
    console.log('├─────────────────────────────────┼──────────┤');
    console.log(`│ Power Authority: Yes            │ ${String(totalYes).padStart(8)} │`);
    console.log(`│ Power Authority: No             │ ${String(totalNo).padStart(8)} │`);
    console.log(`│ รวม (Yes + No)                  │ ${String(totalWithRsm).padStart(8)} │`);
    console.log('├─────────────────────────────────┼──────────┤');
    console.log(`│ ไม่มี Power Authority           │ ${String(allNationalIds.size - nationalIdsWithAuthority.size).padStart(8)} │`);
    console.log('└─────────────────────────────────┴──────────┘\n');

    // 5. แสดง Top 8 (ที่จะแสดงในกราฟ)
    console.log('🔝 Top 8 RSM (ที่แสดงในกราฟ):');
    console.log('┌────────────────────────┬──────────┬──────────┬──────────┐');
    console.log('│ RSM                    │   Yes    │   No     │  Total   │');
    console.log('├────────────────────────┼──────────┼──────────┼──────────┤');

    const top8 = chartData.slice(0, 8);
    let top8Yes = 0;
    let top8No = 0;

    top8.forEach((item) => {
      const rsmPadded = item.rsm.padEnd(22, ' ');
      const yesPadded = String(item.Yes).padStart(8, ' ');
      const noPadded = String(item.No).padStart(8, ' ');
      const totalPadded = String(item.total).padStart(8, ' ');
      console.log(`│ ${rsmPadded} │${yesPadded} │${noPadded} │${totalPadded} │`);
      top8Yes += item.Yes;
      top8No += item.No;
    });

    console.log('├────────────────────────┼──────────┼──────────┼──────────┤');
    console.log(`│ รวม Top 8              │${String(top8Yes).padStart(8)} │${String(top8No).padStart(8)} │${String(top8Yes + top8No).padStart(8)} │`);
    console.log('└────────────────────────┴──────────┴──────────┴──────────┘\n');

    // 6. ตรวจสอบ Duplicate National IDs
    console.log('🔍 ตรวจสอบ Duplicate National IDs...');
    const nationalIdCounts = {};
    allData.forEach((row) => {
      const nationalId = String(row.national_id || '').trim();
      if (nationalId && nationalId !== 'null' && nationalId !== 'undefined') {
        nationalIdCounts[nationalId] = (nationalIdCounts[nationalId] || 0) + 1;
      }
    });

    const duplicates = Object.entries(nationalIdCounts)
      .filter(([id, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (duplicates.length > 0) {
      console.log(`\n⚠️  พบ ${duplicates.length} national_id ที่มีมากกว่า 1 record:\n`);
      console.log('┌──────────────────┬──────────┐');
      console.log('│ National ID      │  Count   │');
      console.log('├──────────────────┼──────────┤');
      duplicates.forEach(([id, count]) => {
        console.log(`│ ${id.padEnd(16)} │ ${String(count).padStart(8)} │`);
      });
      console.log('└──────────────────┴──────────┘\n');
    } else {
      console.log('✅ ไม่พบ duplicate national_id\n');
    }

    // 7. เปรียบเทียบกับที่แสดงใน Legend
    console.log('📊 เปรียบเทียบตัวเลข:');
    console.log('┌─────────────────────────────┬──────────┬──────────┐');
    console.log('│ แหล่งข้อมูล                 │   Yes    │   No     │');
    console.log('├─────────────────────────────┼──────────┼──────────┤');
    console.log(`│ ทั้งหมด (8 RSM)             │${String(totalYes).padStart(8)} │${String(totalNo).padStart(8)} │`);
    console.log(`│ Top 8 (ที่แสดงในกราฟ)       │${String(top8Yes).padStart(8)} │${String(top8No).padStart(8)} │`);
    console.log('└─────────────────────────────┴──────────┴──────────┘\n');

    if (totalYes === top8Yes && totalNo === top8No) {
      console.log('✅ ตัวเลขตรงกัน! (เพราะแสดงครบทั้งหมด 8 RSM)');
    } else {
      console.log('⚠️  ตัวเลขไม่ตรงกัน (เพราะมี RSM มากกว่า 8)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkChartData();
