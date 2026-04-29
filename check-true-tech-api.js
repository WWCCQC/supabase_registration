// Check True Tech count from production API
async function checkTrueTech() {
  console.log('🔍 Fetching RSM Provider data from production API...\n');
  
  const response = await fetch('https://supabase-registration.vercel.app/api/chart/rsm-provider');
  const data = await response.json();
  
  console.log('📊 Summary from API:');
  console.log(JSON.stringify(data.summary, null, 2));
  
  console.log('\n📊 Chart Data:');
  let totalTrueTech = 0;
  data.chartData.forEach(row => {
    const trueTechCount = row['True Tech'] || 0;
    totalTrueTech += trueTechCount;
    console.log(`   ${row.rsm}: ${trueTechCount} True Tech`);
  });
  
  console.log(`\n✅ Total True Tech from chart data: ${totalTrueTech}`);
  console.log(`📊 Total True Tech from summary: ${data.summary.providers['True Tech']}`);
  
  console.log('\n🔍 Expected True Tech: 821');
  console.log(`❌ Difference: ${821 - totalTrueTech} records missing`);
}

checkTrueTech();
