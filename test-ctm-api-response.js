async function testCTMProviderAPI() {
  console.log('🧪 Testing CTM Provider API Response...\n');
  
  try {
    // Test Production
    const prodUrl = 'https://supabase-registration.vercel.app/api/chart/ctm-provider';
    
    console.log('🌐 Production API:');
    console.log('URL:', prodUrl);
    console.log('Fetching...\n');
    
    const response = await fetch(prodUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    console.log('='.repeat(70));
    console.log('📊 API Response Summary:');
    console.log('='.repeat(70));
    
    if (data.summary) {
      console.log(`Total CTMs: ${data.summary.totalCtms}`);
      console.log(`Total Technicians: ${data.summary.totalTechnicians}\n`);
      
      console.log('Provider Breakdown:');
      data.summary.providerBreakdown?.forEach(p => {
        const emoji = p.provider === 'WW-Provider' ? '🎯' : 
                      p.provider === 'True Tech' ? '📱' : '🏪';
        console.log(`${emoji} ${p.provider.padEnd(20)}: ${p.count.toLocaleString()} (${p.percentage}%)`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Comparison with Database:');
    console.log('='.repeat(70));
    console.log('Database values (from previous check):');
    console.log('  WW-Provider: 2,096');
    console.log('  True Tech: 814');
    console.log('  เถ้าแก่เทค: 52');
    console.log('\nAPI values:');
    
    const wwFromAPI = data.summary?.providerBreakdown?.find(p => p.provider === 'WW-Provider')?.count;
    const ttFromAPI = data.summary?.providerBreakdown?.find(p => p.provider === 'True Tech')?.count;
    const tkFromAPI = data.summary?.providerBreakdown?.find(p => p.provider === 'เถ้าแก่เทค')?.count;
    
    console.log(`  WW-Provider: ${wwFromAPI?.toLocaleString() || 'N/A'}`);
    console.log(`  True Tech: ${ttFromAPI?.toLocaleString() || 'N/A'}`);
    console.log(`  เถ้าแก่เทค: ${tkFromAPI?.toLocaleString() || 'N/A'}`);
    
    console.log('\n' + '='.repeat(70));
    
    if (wwFromAPI === 2096) {
      console.log('✅ WW-Provider count is CORRECT (2,096)');
    } else {
      console.log(`❌ WW-Provider count is WRONG: ${wwFromAPI} (should be 2,096)`);
      console.log(`   Difference: ${Math.abs(2096 - (wwFromAPI || 0))} records`);
    }
    
    console.log('='.repeat(70));
    
    // Show top 5 CTMs
    console.log('\n📊 Top 5 CTMs from API:');
    data.chartData?.slice(0, 5).forEach((ctm, i) => {
      console.log(`${i + 1}. ${ctm.ctm}:`);
      console.log(`   WW-Provider: ${ctm['WW-Provider'] || 0}, True Tech: ${ctm['True Tech'] || 0}, เถ้าแก่เทค: ${ctm['เถ้าแก่เทค'] || 0}, Total: ${ctm.total}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCTMProviderAPI();
