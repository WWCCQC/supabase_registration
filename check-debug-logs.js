// ตรวจสอบ debug log จาก Vercel
async function checkDebugLogs() {
  console.log('🔍 Checking RSM Provider API data...\n');
  
  try {
    const response = await fetch('https://supabase-registration.vercel.app/api/chart/rsm-provider');
    const data = await response.json();
    
    console.log('📊 API Summary:');
    console.log('Total fetched records:', data.summary.totalTechnicians);
    console.log('Total RSM:', data.summary.totalRsm);
    
    console.log('\n📊 Provider counts:');
    data.summary.providerBreakdown.forEach(p => {
      console.log(`${p.provider}: ${p.count} (${p.percentage}%)`);
    });
    
    const total = data.summary.providerBreakdown.reduce((sum, p) => sum + p.count, 0);
    console.log(`Total: ${total}`);
    console.log(`Grand total (totalTechnicians): ${data.summary.totalTechnicians}`);
    console.log(`Difference: ${data.summary.totalTechnicians - total} (records not in 3 providers)`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDebugLogs();
