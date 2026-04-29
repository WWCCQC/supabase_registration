async function testAPI() {
  console.log('🔍 Testing RSM Workgroup API...\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/chart/rsm-workgroup?force=true');
    const data = await response.json();
    
    console.log('📊 API Response Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Total Technicians: ${data.summary.totalTechnicians}`);
    console.log(`Total Yes: ${data.summary.totalYes}`);
    console.log(`Total No: ${data.summary.totalNo}`);
    console.log(`Sum: ${data.summary.totalYes + data.summary.totalNo}`);
    console.log('═══════════════════════════════════════\n');
    
    if (data.summary._debug) {
      console.log('🔍 Debug Info:');
      console.log(`DB Yes: ${data.summary._debug.powerAuthority.dbYes}`);
      console.log(`DB No: ${data.summary._debug.powerAuthority.dbNo}`);
      console.log(`Fetched Yes: ${data.summary._debug.powerAuthority.fetchedYes}`);
      console.log(`Fetched No: ${data.summary._debug.powerAuthority.fetchedNo}`);
      console.log('');
    }
    
    console.log('✅ Expected from Supabase: Yes=390, No=2,545');
    console.log('⚠️  Actual from API: Yes=' + data.summary.totalYes + ', No=' + data.summary.totalNo);
    
    if (data.summary.totalYes !== 390 || data.summary.totalNo !== 2545) {
      console.log('\n❌ ERROR: API values do NOT match Supabase!');
    } else {
      console.log('\n✅ SUCCESS: API values match Supabase!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
