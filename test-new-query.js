const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testQuery() {
  console.log('🧪 Testing new query with OR condition...\n');
  
  try {
    // Test the new OR query
    const { count: newTechsCount, error } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true })
      .or('Register.ilike.%างใหม่%,Register.ilike.%ช่า%ใหม่%');
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('✅ New query result (with OR condition):');
    console.log(`   ช่างใหม่: ${newTechsCount} records`);
    
    // Compare with old query
    const { count: oldCount } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true })
      .ilike('Register', '%างใหม่%');
    
    console.log('\n📊 Comparison:');
    console.log(`   Old query (simple ILIKE): ${oldCount} records`);
    console.log(`   New query (OR condition):  ${newTechsCount} records`);
    console.log(`   Difference: ${newTechsCount - oldCount} record(s) captured`);
    
    // Verify total
    const { count: total } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true });
    
    const { count: resigned } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true })
      .ilike('Register', '%ช่างลาออก%');
    
    console.log('\n✅ Final verification:');
    console.log(`   Total: ${total}`);
    console.log(`   ช่างใหม่: ${newTechsCount}`);
    console.log(`   ช่างลาออก: ${resigned}`);
    console.log(`   Sum (New + Resigned): ${newTechsCount + resigned}`);
    console.log(`   Match Total: ${total === newTechsCount + resigned ? '✅ YES' : '❌ NO'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testQuery();
