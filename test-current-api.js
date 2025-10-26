// Test current API endpoint
const fetch = require('node-fetch');

async function testCurrentAPI() {
  console.log('🔍 Testing Current API Endpoint\n');
  
  try {
    const url = 'http://localhost:3000/api/chart/workgroup-count';
    console.log(`📡 Fetching from: ${url}\n`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('\n📊 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Calculate totals
    if (data.data) {
      let total = 0;
      const providerTotals = {
        'WW-Provider': 0,
        'True Tech': 0,
        'เถ้าแก่เทค': 0
      };
      
      Object.keys(data.data).forEach(rsm => {
        const rsmData = data.data[rsm];
        console.log(`\n${rsm}:`);
        Object.keys(rsmData).forEach(key => {
          if (!key.includes('_Installation') && !key.includes('_Repair')) {
            console.log(`  ${key}: ${rsmData[key]}`);
          } else {
            console.log(`  ${key}: ${rsmData[key]}`);
            total += rsmData[key];
            
            // Add to provider totals
            const provider = key.split('_')[0];
            if (providerTotals[provider] !== undefined) {
              providerTotals[provider] += rsmData[key];
            }
          }
        });
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('CALCULATED TOTALS:');
      console.log('='.repeat(80));
      console.log(`Grand Total (calculated): ${total}`);
      console.log(`Grand Total (from API): ${data.grandTotal || 'NOT PROVIDED'}`);
      console.log('\nProvider Totals:');
      Object.entries(providerTotals).forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️ Make sure the development server is running (npm run dev)');
  }
}

testCurrentAPI();
