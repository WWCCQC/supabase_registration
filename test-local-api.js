async function testLocalAPI() {
  console.log('🧪 Testing LOCAL RSM Provider API\n');
  
  try {
    const url = 'http://localhost:3000/api/chart/rsm-provider';
    console.log(`Fetching: ${url}\n`);
    
    const response = await fetch(url, {
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
    
    console.log('=' .repeat(60));
    console.log('📊 API RESPONSE');
    console.log('='.repeat(60));
    
    console.log('\nProvider Breakdown (for legend):');
    data.summary?.providerBreakdown?.forEach(p => {
      const emoji = p.provider === 'True Tech' ? '🎯' : '  ';
      console.log(`${emoji} ${p.provider.padEnd(20)}: ${p.count} (${p.percentage}%)`);
    });
    
    const trueTechCount = data.summary?.providerBreakdown?.find(p => p.provider === 'True Tech')?.count;
    
    console.log('\n' + '='.repeat(60));
    if (trueTechCount === 814) {
      console.log('✅ TRUE TECH COUNT IS CORRECT (814)');
    } else {
      console.log(`❌ TRUE TECH COUNT IS WRONG: ${trueTechCount} (should be 814)`);
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLocalAPI();
