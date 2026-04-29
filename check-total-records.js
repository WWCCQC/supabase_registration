require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTotalRecords() {
  console.log('🔍 Checking total records in Supabase...\n');

  try {
    // Method 1: Count with head=true (fast)
    console.log('📊 Method 1: Using count with head=true');
    const { count: headCount, error: headError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true });
    
    if (headError) {
      console.error('❌ Error:', headError);
    } else {
      console.log(`✅ Total records (head=true): ${headCount?.toLocaleString()}`);
    }

    // Method 2: Count without head (may return data)
    console.log('\n📊 Method 2: Using count without head');
    const { count: normalCount, error: normalError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact' });
    
    if (normalError) {
      console.error('❌ Error:', normalError);
    } else {
      console.log(`✅ Total records (normal): ${normalCount?.toLocaleString()}`);
    }

    // Method 3: Count unique national_id (with pagination)
    console.log('\n📊 Method 3: Fetching ALL records with pagination');
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('technicians')
        .select('national_id, tech_id, provider')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (pageError) {
        console.error('❌ Error fetching page:', pageError);
        break;
      }
      
      if (!pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(pageData);
        console.log(`   Fetched page ${page + 1}: ${pageData.length} records (total so far: ${allData.length})`);
        page++;
        
        if (pageData.length < pageSize) {
          hasMore = false;
        }
      }
    }
    
    const totalRecords = allData.length;
    const uniqueNationalIds = new Set(allData.map(t => t.national_id).filter(Boolean));
    const recordsWithNationalId = allData.filter(t => t.national_id).length;
    const recordsWithoutNationalId = totalRecords - recordsWithNationalId;
    
    console.log(`\n✅ Total records fetched: ${totalRecords.toLocaleString()}`);
    console.log(`✅ Unique national_id: ${uniqueNationalIds.size.toLocaleString()}`);
    console.log(`✅ Records with national_id: ${recordsWithNationalId.toLocaleString()}`);
    console.log(`✅ Records without national_id: ${recordsWithoutNationalId.toLocaleString()}`);
    
    if (totalRecords !== uniqueNationalIds.size) {
      console.log(`\n⚠️  Duplicate national_id found: ${totalRecords - uniqueNationalIds.size} duplicates`);
    }

    // Method 4: Group by provider (with pagination)
    console.log('\n📊 Method 4: Count by provider (with pagination)');
    let providerData = [];
    page = 0;
    hasMore = true;
    
    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('technicians')
        .select('provider, national_id')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (pageError) {
        console.error('❌ Error fetching page:', pageError);
        break;
      }
      
      if (!pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        providerData = providerData.concat(pageData);
        page++;
        
        if (pageData.length < pageSize) {
          hasMore = false;
        }
      }
    }
    
    const providerCounts = {};
    const providerUniqueIds = {};
    
    providerData.forEach(t => {
      const provider = t.provider || 'NULL';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      
      if (!providerUniqueIds[provider]) {
        providerUniqueIds[provider] = new Set();
      }
      if (t.national_id) {
        providerUniqueIds[provider].add(t.national_id);
      }
    });
    
    console.log('\nProvider breakdown:');
    Object.entries(providerCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([provider, count]) => {
        const uniqueCount = providerUniqueIds[provider].size;
        const dupCount = count - uniqueCount;
        console.log(`  ${provider}: ${count.toLocaleString()} records (${uniqueCount.toLocaleString()} unique${dupCount > 0 ? `, ${dupCount} duplicates` : ''})`);
      });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTotalRecords();
