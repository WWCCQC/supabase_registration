// Test API after fix
async function testAPI() {
  console.log('🧪 Testing RSM Workgroup API after fix...\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/chart/rsm-workgroup?force=true');
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ API Error:', data.error);
      return;
    }
    
    console.log('✅ API Response Summary:');
    console.log('═'.repeat(60));
    console.log(`🟢 Total Yes:  ${data.summary.totalYes.toLocaleString()} คน`);
    console.log(`🔴 Total No:   ${data.summary.totalNo.toLocaleString()} คน`);
    console.log(`📊 Total:      ${(data.summary.totalYes + data.summary.totalNo).toLocaleString()} คน`);
    console.log('═'.repeat(60));
    
    console.log('\n🔍 Debug Info:');
    console.log(`   DB Count Yes: ${data.summary._debug.powerAuthority.dbYes}`);
    console.log(`   DB Count No:  ${data.summary._debug.powerAuthority.dbNo}`);
    console.log(`   Fetched Yes:  ${data.summary._debug.powerAuthority.fetchedYes}`);
    console.log(`   Fetched No:   ${data.summary._debug.powerAuthority.fetchedNo}`);
    console.log(`   Yes Diff:     ${data.summary._debug.powerAuthority.yesDiff}`);
    console.log(`   No Diff:      ${data.summary._debug.powerAuthority.noDiff}`);
    
    // ตรวจสอบว่าตรงกับข้อมูลจริงหรือไม่
    const expectedYes = 400;
    const expectedNo = 2537;
    
    console.log('\n✔️  Validation:');
    if (data.summary.totalYes === expectedYes) {
      console.log(`   ✅ Yes count is correct: ${expectedYes}`);
    } else {
      console.log(`   ❌ Yes count mismatch: expected ${expectedYes}, got ${data.summary.totalYes}`);
    }
    
    if (data.summary.totalNo === expectedNo) {
      console.log(`   ✅ No count is correct: ${expectedNo}`);
    } else {
      console.log(`   ❌ No count mismatch: expected ${expectedNo}, got ${data.summary.totalNo}`);
    }
    
    console.log('\n💡 Note: Make sure Next.js dev server is running on port 3001');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Please start Next.js dev server: npm run dev');
  }
}

testAPI();
