// Debug script สำหรับตรวจสอบ CTM Provider API response

async function debugCtmApi() {
  try {
    console.log('🔍 Fetching CTM Provider API...');
    const response = await fetch('http://localhost:3001/api/chart/ctm-provider');
    const data = await response.json();
    
    console.log('\n📊 Summary:');
    console.log('Total CTMs:', data.summary.totalCtms);
    console.log('Total Technicians:', data.summary.totalTechnicians);
    
    console.log('\n🏪 Provider Breakdown:');
    data.summary.providerBreakdown.forEach(provider => {
      console.log(`${provider.provider}: ${provider.count} (${provider.percentage}%)`);
    });
    
    console.log('\n📈 Top 5 CTMs:');
    data.chartData.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.ctm}: Total ${item.total}`);
      console.log(`   - WW-Provider: ${item['WW-Provider'] || 0}`);
      console.log(`   - True Tech: ${item['True Tech'] || 0}`);
      console.log(`   - เถ้าแก่เทค: ${item['เถ้าแก่เทค'] || 0}`);
      console.log('');
    });
    
    console.log('\n🔍 Providers array:', data.providers);
    
    // ตรวจสอบ character encoding
    console.log('\n🔤 Character encoding test:');
    data.providers.forEach(provider => {
      console.log(`Provider: "${provider}"`);
      console.log(`Length: ${provider.length}`);
      console.log(`Bytes: ${Buffer.from(provider, 'utf8').toString('hex')}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugCtmApi();