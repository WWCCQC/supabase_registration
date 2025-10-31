async function checkPowerAuthorityAPI() {
  try {
    console.log('🔍 Fetching RSM-Workgroup chart data...');
    const response = await fetch('http://localhost:3000/api/chart/rsm-workgroup');
    const data = await response.json();
    
    console.log('📊 API Response Structure:');
    console.log('- Chart Data Length:', data.chartData?.length || 0);
    console.log('- Summary:', data.summary);
    
    if (data.chartData && data.chartData.length > 0) {
      console.log('\n📊 Chart Data Sample:');
      data.chartData.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. RSM: ${item.rsm}, Yes: ${item.Yes}, No: ${item.No}`);
      });
      
      // คำนวณยอดรวม
      let totalYes = 0;
      let totalNo = 0;
      
      data.chartData.forEach(item => {
        totalYes += item.Yes || 0;
        totalNo += item.No || 0;
      });
      
      console.log('\n📊 Chart Data Totals:');
      console.log(`Total Yes: ${totalYes}`);
      console.log(`Total No: ${totalNo}`);
      console.log(`Grand Total: ${totalYes + totalNo}`);
    }
    
    if (data.summary) {
      console.log('\n📊 Summary from API:');
      console.log(`Summary Total Yes: ${data.summary.totalYes}`);
      console.log(`Summary Total No: ${data.summary.totalNo}`);
      console.log(`Summary Grand Total: ${data.summary.totalYes + data.summary.totalNo}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPowerAuthorityAPI();