const fetch = require('node-fetch');

async function testPowerAuthorityAPI() {
  console.log('🔍 Testing Power Authority API...\n');
  
  try {
    // Test rsm-workgroup API
    const response = await fetch('http://localhost:3000/api/chart/rsm-workgroup?force=true');
    const data = await response.json();
    
    console.log('📊 API Response Summary:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Technicians: ${data.summary.totalTechnicians}`);
    console.log(`Total RSM: ${data.summary.totalRsm}`);
    console.log(`Total Yes: ${data.summary.totalYes}`);
    console.log(`Total No: ${data.summary.totalNo}`);
    console.log(`Sum: ${data.summary.totalYes + data.summary.totalNo}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Show debug info
    if (data.summary._debug) {
      console.log('🔍 Debug Information:');
      console.log('───────────────────────────────────────────────────────');
      console.log(`DB Count: ${data.summary._debug.dbCount}`);
      console.log(`Fetched Count: ${data.summary._debug.fetchedCount}`);
      console.log(`Unique National IDs: ${data.summary._debug.uniqueNationalIds}`);
      console.log('');
      console.log('Power Authority:');
      console.log(`  DB Yes: ${data.summary._debug.powerAuthority.dbYes}`);
      console.log(`  DB No: ${data.summary._debug.powerAuthority.dbNo}`);
      console.log(`  Fetched Yes: ${data.summary._debug.powerAuthority.fetchedYes}`);
      console.log(`  Fetched No: ${data.summary._debug.powerAuthority.fetchedNo}`);
      console.log(`  Yes Diff: ${data.summary._debug.powerAuthority.yesDiff}`);
      console.log(`  No Diff: ${data.summary._debug.powerAuthority.noDiff}`);
      console.log('───────────────────────────────────────────────────────\n');
    }
    
    // Show chart data by RSM
    console.log('📊 Chart Data by RSM:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('RSM'.padEnd(25) + 'Yes'.padStart(8) + 'No'.padStart(8) + 'Total'.padStart(10));
    console.log('───────────────────────────────────────────────────────');
    
    data.chartData.forEach(rsm => {
      console.log(
        rsm.rsm.padEnd(25) +
        String(rsm.Yes).padStart(8) +
        String(rsm.No).padStart(8) +
        String(rsm.total).padStart(10)
      );
    });
    
    // Calculate totals from chartData
    const chartYesTotal = data.chartData.reduce((sum, rsm) => sum + rsm.Yes, 0);
    const chartNoTotal = data.chartData.reduce((sum, rsm) => sum + rsm.No, 0);
    
    console.log('───────────────────────────────────────────────────────');
    console.log('Chart Data Total'.padEnd(25) + 
                String(chartYesTotal).padStart(8) + 
                String(chartNoTotal).padStart(8) + 
                String(chartYesTotal + chartNoTotal).padStart(10));
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Compare with summary
    console.log('⚠️  Comparison:');
    console.log('───────────────────────────────────────────────────────');
    console.log(`Summary Total Yes: ${data.summary.totalYes}`);
    console.log(`Chart Data Yes:    ${chartYesTotal}`);
    console.log(`Difference:        ${data.summary.totalYes - chartYesTotal}`);
    console.log('');
    console.log(`Summary Total No:  ${data.summary.totalNo}`);
    console.log(`Chart Data No:     ${chartNoTotal}`);
    console.log(`Difference:        ${data.summary.totalNo - chartNoTotal}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Expected values from Supabase
    console.log('✅ Expected values from Supabase:');
    console.log('───────────────────────────────────────────────────────');
    console.log('Yes: 390');
    console.log('No: 2,545');
    console.log('Total: 2,935');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPowerAuthorityAPI();
