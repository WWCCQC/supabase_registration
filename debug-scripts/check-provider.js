// Check current provider data from Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProviderData() {
  try {
    console.log('🔍 Checking provider data...\n');
    
    // Get all technicians with pagination
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('rsm, provider')
        .range(from, from + pageSize - 1);
        
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Total records: ${allData.length}\n`);
    
    // Count providers
    const providerCount = {};
    const rsmCount = {};
    
    allData.forEach(row => {
      const provider = String(row.provider || '').trim();
      const rsm = String(row.rsm || '').trim();
      
      if (provider) {
        providerCount[provider] = (providerCount[provider] || 0) + 1;
      }
      
      if (rsm) {
        rsmCount[rsm] = (rsmCount[rsm] || 0) + 1;
      }
    });
    
    console.log('📈 Provider Distribution:');
    Object.entries(providerCount)
      .sort(([,a], [,b]) => b - a)
      .forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });
      
    console.log(`\n📊 Total RSM: ${Object.keys(rsmCount).length}`);
    console.log(`📊 Total Providers: ${Object.keys(providerCount).length}`);
    
    // Check specific providers
    console.log('\n🔍 Expected providers:');
    console.log(`  WW-Provider: ${providerCount['WW-Provider'] || 0}`);
    console.log(`  True Tech: ${providerCount['True Tech'] || 0}`);
    console.log(`  เถ้าแก่เทค: ${providerCount['เถ้าแก่เทค'] || 0}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkProviderData();
