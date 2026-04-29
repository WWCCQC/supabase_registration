// Test script to verify force refresh functionality for workgroup count
const baseUrl = 'http://localhost:3000/api/chart/workgroup-count';

async function testForceRefresh() {
  console.log('🔍 Testing Force Refresh functionality...\n');

  try {
    // Test 1: Normal request
    console.log('1️⃣ Normal request (no force):');
    const normalResponse = await fetch(baseUrl);
    const normalData = await normalResponse.json();
    console.log(`   Workgroup Count: ${normalData.grandTotal}`);
    console.log(`   Force Refresh: ${normalData.forceRefresh || 'undefined'}`);
    console.log(`   Message: ${normalData.message}`);
    console.log(`   Timestamp: ${normalData.timestamp}\n`);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Force refresh request
    console.log('2️⃣ Force refresh request:');
    const forceResponse = await fetch(`${baseUrl}?force=true`);
    const forceData = await forceResponse.json();
    console.log(`   Workgroup Count: ${forceData.grandTotal}`);
    console.log(`   Force Refresh: ${forceData.forceRefresh}`);
    console.log(`   Message: ${forceData.message}`);
    console.log(`   Timestamp: ${forceData.timestamp}\n`);

    // Test 3: With filters + force refresh
    console.log('3️⃣ Force refresh with filters:');
    const filterForceResponse = await fetch(`${baseUrl}?rsm=หญิง&force=true`);
    const filterForceData = await filterForceResponse.json();
    console.log(`   Workgroup Count: ${filterForceData.grandTotal}`);
    console.log(`   Force Refresh: ${filterForceData.forceRefresh}`);
    console.log(`   Message: ${filterForceData.message}`);
    console.log(`   Timestamp: ${filterForceData.timestamp}\n`);

    console.log('✅ Force refresh testing completed!');

  } catch (error) {
    console.error('❌ Error testing force refresh:', error.message);
  }
}

testForceRefresh();