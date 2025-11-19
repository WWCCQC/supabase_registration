// Check all provider values that might be True Tech
async function checkProviders() {
  console.log('🔍 Fetching all technicians to check provider values...\n');
  
  const response = await fetch('https://supabase-registration.vercel.app/api/technicians?page=1&pageSize=3000');
  const result = await response.json();
  
  const providers = {};
  const trueTechVariants = [];
  
  result.data.forEach(tech => {
    const provider = tech.provider || 'null';
    providers[provider] = (providers[provider] || 0) + 1;
    
    // Check for True Tech variants
    if (provider && provider.toLowerCase().includes('true')) {
      trueTechVariants.push({ id: tech.tech_id, provider: tech.provider, rsm: tech.rsm });
    }
  });
  
  console.log('📊 All unique providers:');
  Object.entries(providers).forEach(([name, count]) => {
    console.log(`   ${name}: ${count}`);
  });
  
  console.log('\n🔍 True Tech variants found:');
  const variantCounts = {};
  trueTechVariants.forEach(v => {
    variantCounts[v.provider] = (variantCounts[v.provider] || 0) + 1;
  });
  Object.entries(variantCounts).forEach(([name, count]) => {
    console.log(`   "${name}": ${count}`);
  });
  
  console.log(`\n✅ Total records: ${result.data.length}`);
  console.log(`📊 Total with "true" in provider name: ${trueTechVariants.length}`);
}

checkProviders();
