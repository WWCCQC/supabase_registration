const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExactAPILogic() {
  console.log('🧪 Testing EXACT API Logic (same as rsm-provider route)\n');
  console.log('='.repeat(60));
  
  try {
    const providers = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];
    const providerExactCounts = {};
    
    console.log('\n1️⃣ Counting each provider WITHOUT filters (exact match):\n');
    
    // Count each provider with exact match WITHOUT filters
    for (const provider of providers) {
      const { count, error } = await supabase
        .from("technicians")
        .select("*", { count: "exact", head: true })
        .eq("provider", provider);
      
      if (error) {
        console.error(`❌ Error for ${provider}:`, error);
        continue;
      }
      
      providerExactCounts[provider] = count || 0;
      const emoji = provider === "True Tech" ? "🎯" : "  ";
      console.log(`${emoji} ${provider.padEnd(20)}: ${count}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary (what API should return):');
    console.log('='.repeat(60));
    
    const totalFromExactCounts = Object.values(providerExactCounts).reduce((sum, count) => sum + count, 0);
    
    const providerBreakdown = providers.map((provider) => {
      const count = providerExactCounts[provider] || 0;
      const percentage = totalFromExactCounts > 0 ? Math.round((count / totalFromExactCounts) * 100) : 0;
      return {
        provider,
        count,
        percentage
      };
    });
    
    console.log('\nProvider Breakdown (for legend):');
    providerBreakdown.forEach(p => {
      const emoji = p.provider === 'True Tech' ? '🎯' : '  ';
      console.log(`${emoji} ${p.provider.padEnd(20)}: ${p.count} (${p.percentage}%)`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Expected Results:');
    console.log('='.repeat(60));
    console.log(`Total: ${totalFromExactCounts}`);
    console.log(`True Tech count in legend: ${providerExactCounts["True Tech"]}`);
    
    if (providerExactCounts["True Tech"] === 814) {
      console.log('\n🎉 TRUE TECH COUNT IS CORRECT (814)');
    } else {
      console.log(`\n⚠️  TRUE TECH COUNT IS WRONG: ${providerExactCounts["True Tech"]} (should be 814)`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📤 JSON Response (what API returns):');
    console.log('='.repeat(60));
    console.log(JSON.stringify({
      summary: {
        providerBreakdown
      }
    }, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testExactAPILogic();
