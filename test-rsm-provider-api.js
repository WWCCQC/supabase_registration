async function testRsmProviderAPI() {
  console.log('🧪 Testing RSM Provider API...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/chart/rsm-provider');
    const data = await response.json();
    
    console.log('📊 API Response Summary:');
    console.log('Total RSM:', data.summary?.totalRsm);
    console.log('Total Technicians:', data.summary?.totalTechnicians);
    console.log('\n📋 Provider Breakdown:');
    data.summary?.providerBreakdown?.forEach(p => {
      console.log(`  ${p.provider}: ${p.count} (${p.percentage}%)`);
    });
    
    console.log('\n📊 Providers (old format):');
    console.log(data.summary?.providers);
    
    console.log('\n📈 Chart Data (first 5 RSM):');
    data.chartData?.slice(0, 5).forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.rsm}: WW=${row['WW-Provider']}, TT=${row['True Tech']}, TK=${row['เถ้าแก่เทค']}, Total=${row.total}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testRsmProviderAPI();
