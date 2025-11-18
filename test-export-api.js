async function testExportAPI() {
  console.log('🧪 Testing Export API...\n');
  
  const baseUrl = 'https://supabase-registration.vercel.app';
  // const baseUrl = 'http://localhost:3000'; // For local testing
  
  const pageSize = 200;
  let page = 1;
  let allRecords = [];
  let totalFromAPI = 0;
  
  try {
    while (true) {
      // Same params as exportExcel() - NO FILTERS
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: 'national_id',
        dir: 'asc'
      });
      
      const url = `${baseUrl}/api/technicians?${params.toString()}`;
      console.log(`📡 Fetching page ${page}: ${url}`);
      
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const json = await res.json();
      console.log(`   ✅ Page ${page}: ${json.rows?.length || 0} records`);
      console.log(`      Total in DB: ${json.total}`);
      console.log(`      Total pages: ${json.totalPages}`);
      
      if (page === 1) {
        totalFromAPI = json.total;
      }
      
      allRecords.push(...(json.rows || []));
      
      if (page >= (json.totalPages || 1)) {
        break;
      }
      
      page++;
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 EXPORT RESULTS:');
    console.log('='.repeat(70));
    console.log(`Total from API "total" field: ${totalFromAPI.toLocaleString()}`);
    console.log(`Total records fetched: ${allRecords.length.toLocaleString()}`);
    console.log(`Pages fetched: ${page}`);
    
    if (allRecords.length !== totalFromAPI) {
      console.log(`\n⚠️  MISMATCH: Fetched ${allRecords.length} but API says total is ${totalFromAPI}`);
      console.log(`   Difference: ${Math.abs(allRecords.length - totalFromAPI)} records`);
    } else {
      console.log(`\n✅ MATCH: Fetched records equals API total`);
    }
    
    // Check for duplicates
    const uniqueNationalIds = new Set(allRecords.map(r => r.national_id).filter(Boolean));
    console.log(`\nUnique national_id: ${uniqueNationalIds.size.toLocaleString()}`);
    
    if (uniqueNationalIds.size !== allRecords.length) {
      console.log(`⚠️  Duplicates found: ${allRecords.length - uniqueNationalIds.size} duplicate records`);
    }
    
    // Provider breakdown
    const providerCounts = {};
    allRecords.forEach(r => {
      const provider = r.provider || 'NULL';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });
    
    console.log('\n📊 Provider breakdown from export:');
    Object.entries(providerCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([provider, count]) => {
        console.log(`   ${provider}: ${count.toLocaleString()}`);
      });
    
    console.log('\n' + '='.repeat(70));
    console.log('🎯 EXPECTED vs ACTUAL:');
    console.log('='.repeat(70));
    console.log('Expected (from Supabase):');
    console.log('   Total: 2,962');
    console.log('   WW-Provider: 2,096');
    console.log('   True Tech: 814');
    console.log('   เถ้าแก่เทค: 52');
    console.log('\nActual (from Export API):');
    console.log(`   Total: ${allRecords.length.toLocaleString()}`);
    console.log(`   WW-Provider: ${providerCounts['WW-Provider'] || 0}`);
    console.log(`   True Tech: ${providerCounts['True Tech'] || 0}`);
    console.log(`   เถ้าแก่เทค: ${providerCounts['เถ้าแก่เทค'] || 0}`);
    
    if (allRecords.length === 2947) {
      console.log('\n❌ PROBLEM CONFIRMED: Export returns 2,947 (missing 15 records)');
      console.log('   This matches your report!');
    } else if (allRecords.length === 2962) {
      console.log('\n✅ FIXED: Export now returns correct 2,962 records');
    } else {
      console.log(`\n⚠️  UNEXPECTED: Export returns ${allRecords.length} records`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testExportAPI();
