// Test RSM Workgroup API endpoint
async function testAPI() {
  console.log('🧪 Testing /api/chart/rsm-workgroup endpoint...\n');

  try {
    const response = await fetch('http://localhost:3001/api/chart/rsm-workgroup', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ API Response received!\n');

    // Display chart data
    console.log('📊 Chart Data (Top 8 RSM):');
    console.log('┌────────────────────────┬──────────┬──────────┬──────────┐');
    console.log('│ RSM                    │   Yes    │   No     │  Total   │');
    console.log('├────────────────────────┼──────────┼──────────┼──────────┤');

    data.chartData.forEach((item) => {
      const rsmPadded = item.rsm.padEnd(22, ' ');
      const yesPadded = String(item.Yes).padStart(8, ' ');
      const noPadded = String(item.No).padStart(8, ' ');
      const totalPadded = String(item.total).padStart(8, ' ');
      console.log(`│ ${rsmPadded} │${yesPadded} │${noPadded} │${totalPadded} │`);
    });

    console.log('└────────────────────────┴──────────┴──────────┴──────────┘\n');

    // Display summary
    console.log('📈 Summary:');
    console.log('┌─────────────────────────────────┬──────────┐');
    console.log('│ รายการ                          │  จำนวน   │');
    console.log('├─────────────────────────────────┼──────────┤');
    console.log(`│ จำนวน RSM ทั้งหมด               │ ${String(data.summary.totalRsm).padStart(8)} │`);
    console.log(`│ จำนวน Technicians ทั้งหมด       │ ${String(data.summary.totalTechnicians).padStart(8)} │`);
    console.log(`│ จำนวน Technicians ที่มี RSM     │ ${String(data.summary.totalTechniciansWithRsm).padStart(8)} │`);
    console.log('├─────────────────────────────────┼──────────┤');
    console.log(`│ Power Authority: Yes            │ ${String(data.summary.totalYes).padStart(8)} │`);
    console.log(`│ Power Authority: No             │ ${String(data.summary.totalNo).padStart(8)} │`);
    console.log(`│ รวม (Yes + No)                  │ ${String(data.summary.totalYes + data.summary.totalNo).padStart(8)} │`);
    console.log('├─────────────────────────────────┼──────────┤');
    console.log(`│ ไม่มี RSM                       │ ${String(data.summary.recordsWithoutRsm).padStart(8)} │`);
    console.log(`│ ไม่มี Power Authority           │ ${String(data.summary.recordsWithoutAuthority).padStart(8)} │`);
    console.log('└─────────────────────────────────┴──────────┘\n');

    // Calculate Top 8 totals
    const top8Yes = data.chartData.reduce((sum, item) => sum + item.Yes, 0);
    const top8No = data.chartData.reduce((sum, item) => sum + item.No, 0);

    console.log('🔝 Top 8 Totals:');
    console.log(`   Yes: ${top8Yes}`);
    console.log(`   No: ${top8No}`);
    console.log(`   Total: ${top8Yes + top8No}\n`);

    // Comparison
    console.log('📊 เปรียบเทียบ:');
    if (top8Yes === data.summary.totalYes && top8No === data.summary.totalNo) {
      console.log('✅ ตัวเลขตรงกัน (แสดงครบทั้งหมด 8 RSM)');
    } else {
      console.log('⚠️  ตัวเลขไม่ตรง:');
      console.log(`   Summary: Yes=${data.summary.totalYes}, No=${data.summary.totalNo}`);
      console.log(`   Top 8:   Yes=${top8Yes}, No=${top8No}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
