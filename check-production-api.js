async function checkProductionAPI() {
  console.log('🌐 Checking Production RSM Provider API...\n');
  
  try {
    // ใส่ Production URL ของคุณที่นี่
    const productionURL = 'https://your-app.vercel.app/api/chart/rsm-provider';
    
    console.log(`Fetching from: ${productionURL}\n`);
    
    const response = await fetch(productionURL, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log('📊 Production API Response:');
    console.log('========================\n');
    
    console.log('Summary Data:');
    console.log(`  Total RSM: ${data.summary?.totalRsm}`);
    console.log(`  Total Technicians: ${data.summary?.totalTechnicians}\n`);
    
    console.log('Provider Breakdown (Legend):');
    data.summary?.providerBreakdown?.forEach(p => {
      const icon = p.provider === 'True Tech' ? '🎯' : '  ';
      console.log(`  ${icon} ${p.provider}: ${p.count} (${p.percentage}%)`);
    });
    
    console.log('\n📈 Chart Data (first 3 RSM):');
    data.chartData?.slice(0, 3).forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.rsm}:`);
      console.log(`     WW-Provider: ${row['WW-Provider']}`);
      console.log(`     True Tech: ${row['True Tech']}`);
      console.log(`     เถ้าแก่เทค: ${row['เถ้าแก่เทค']}`);
      console.log(`     Total: ${row.total}`);
    });
    
    console.log('\n✅ Check completed');
    
    // Check if True Tech count is correct
    const trueTechCount = data.summary?.providerBreakdown?.find(p => p.provider === 'True Tech')?.count;
    if (trueTechCount === 814) {
      console.log('\n🎉 True Tech count is CORRECT (814)');
    } else {
      console.log(`\n⚠️  True Tech count is WRONG: ${trueTechCount} (should be 814)`);
      console.log('    → Try hard refresh (Ctrl+Shift+R) or clear cache');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProductionAPI();
