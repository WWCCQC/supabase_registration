const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCTMProviderData() {
  console.log('🔍 ตรวจสอบข้อมูล CTM Provider Distribution จาก Supabase...\n');
  console.log('='.repeat(80));
  
  try {
    // Count WW-Provider
    console.log('📊 นับจำนวน WW-Provider...\n');
    
    const { count: wwCount, error: wwError } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'WW-Provider');
    
    if (wwError) {
      console.error('Error counting WW-Provider:', wwError);
      return;
    }
    
    console.log(`✅ WW-Provider: ${wwCount?.toLocaleString() || 0} records\n`);
    
    // Count all main providers
    const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
    console.log('📋 นับจำนวนทั้งหมด 3 providers:\n');
    console.log('='.repeat(80));
    
    const providerCounts = {};
    
    for (const provider of providers) {
      const { count, error } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .eq('provider', provider);
      
      if (error) {
        console.error(`Error counting ${provider}:`, error);
        continue;
      }
      
      providerCounts[provider] = count || 0;
      const emoji = provider === 'WW-Provider' ? '🎯' : provider === 'True Tech' ? '📱' : '🏪';
      console.log(`${emoji} ${provider.padEnd(20)}: ${(count || 0).toLocaleString()} records`);
    }
    
    const total = Object.values(providerCounts).reduce((sum, count) => sum + count, 0);
    
    console.log('='.repeat(80));
    console.log(`📊 TOTAL (3 providers):      ${total.toLocaleString()} records`);
    console.log('='.repeat(80));
    
    // Percentage
    console.log('\n📊 เปอร์เซ็นต์:');
    console.log('-'.repeat(80));
    providers.forEach(provider => {
      const count = providerCounts[provider];
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      console.log(`   ${provider.padEnd(20)}: ${count.toLocaleString().padStart(6)} (${percentage}%)`);
    });
    
    // Count by CTM
    console.log('\n📋 จำนวนแยกตาม CTM (WW-Provider only):');
    console.log('='.repeat(80));
    
    // Fetch WW-Provider data with CTM
    let allWWData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('national_id, ctm, provider')
        .eq('provider', 'WW-Provider')
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error('Error:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allWWData = allWWData.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    // Group by CTM
    const byCTM = {};
    allWWData.forEach(row => {
      const ctm = row.ctm || '(ไม่มี CTM)';
      if (!byCTM[ctm]) {
        byCTM[ctm] = new Set();
      }
      byCTM[ctm].add(row.national_id);
    });
    
    console.log('CTM'.padEnd(25) + 'WW-Provider'.padStart(15));
    console.log('-'.repeat(80));
    
    const sortedCTMs = Object.keys(byCTM).sort((a, b) => {
      return byCTM[b].size - byCTM[a].size;
    });
    
    let grandTotal = 0;
    
    sortedCTMs.forEach(ctm => {
      const count = byCTM[ctm].size;
      grandTotal += count;
      console.log(ctm.padEnd(25) + count.toString().padStart(15));
    });
    
    console.log('='.repeat(80));
    console.log('TOTAL'.padEnd(25) + grandTotal.toString().padStart(15));
    console.log('='.repeat(80));
    
    console.log('\n💡 Summary:');
    console.log(`   WW-Provider ทั้งหมด: ${wwCount?.toLocaleString()} records`);
    console.log(`   แยกตาม CTM (unique): ${grandTotal.toLocaleString()} records`);
    
    if (wwCount !== grandTotal) {
      console.log(`   ⚠️  ความแตกต่าง: ${Math.abs(wwCount - grandTotal)} records`);
    } else {
      console.log(`   ✅ ตรงกัน!`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCTMProviderData();
