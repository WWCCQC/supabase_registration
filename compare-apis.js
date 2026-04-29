// Compare KPI API vs RSM Provider API
async function compareAPIs() {
  console.log('🔍 Comparing KPI API vs RSM Provider API...\n');
  
  try {
    // Get KPI data
    const kpiResponse = await fetch('https://supabase-registration.vercel.app/api/kpis');
    const kpiData = await kpiResponse.json();
    
    console.log('📊 KPI API - by_provider:');
    console.log('================================');
    if (kpiData.by_provider) {
      kpiData.by_provider.forEach(p => {
        console.log(`${p.key}: ${p.count}`);
      });
    }
    
    // Get RSM Provider data
    const rsmResponse = await fetch('https://supabase-registration.vercel.app/api/chart/rsm-provider');
    const rsmData = await rsmResponse.json();
    
    console.log('\n📊 RSM Provider Chart API - summary:');
    console.log('================================');
    rsmData.summary.providerBreakdown.forEach(p => {
      console.log(`${p.provider}: ${p.count}`);
    });
    
    console.log('\n📊 Comparison:');
    console.log('================================');
    
    const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
    
    providers.forEach(provider => {
      const kpiCount = kpiData.by_provider?.find(p => p.key === provider)?.count || 0;
      const rsmCount = rsmData.summary.providerBreakdown.find(p => p.provider === provider)?.count || 0;
      const diff = rsmCount - kpiCount;
      
      console.log(`${provider}:`);
      console.log(`  KPI: ${kpiCount}`);
      console.log(`  RSM: ${rsmCount}`);
      console.log(`  Diff: ${diff > 0 ? '+' : ''}${diff}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

compareAPIs();
