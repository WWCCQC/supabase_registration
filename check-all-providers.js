// ตรวจสอบ all unique provider values
async function checkAllProviders() {
  console.log('🔍 Checking all unique provider values in database...\n');
  
  try {
    // Fetch from API that returns all technicians
    let allProviders = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await fetch(`https://supabase-registration.vercel.app/api/technicians?page=${page}&pageSize=1000`);
      const result = await response.json();
      
      if (result.data && result.data.length > 0) {
        allProviders = [...allProviders, ...result.data];
        page++;
        hasMore = result.data.length === 1000;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Total records fetched: ${allProviders.length}`);
    
    // Count unique providers
    const providerCounts = {};
    allProviders.forEach(tech => {
      const provider = tech.provider || 'null';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });
    
    console.log('\n📊 All unique provider values:');
    console.log('================================');
    Object.entries(providerCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([provider, count]) => {
        console.log(`"${provider}": ${count}`);
      });
    
    const total = Object.values(providerCounts).reduce((sum, count) => sum + count, 0);
    console.log(`\n📊 Grand Total: ${total}`);
    
    const ww = providerCounts['WW-Provider'] || 0;
    const tt = providerCounts['True Tech'] || 0;
    const ta = providerCounts['เถ้าแก่เทค'] || 0;
    const known = ww + tt + ta;
    const unknown = total - known;
    
    console.log('\n📊 Known providers:');
    console.log(`  WW-Provider: ${ww}`);
    console.log(`  True Tech: ${tt}`);
    console.log(`  เถ้าแก่เทค: ${ta}`);
    console.log(`  Total known: ${known}`);
    console.log(`  Unknown/Other: ${unknown}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllProviders();
