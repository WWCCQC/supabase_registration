const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTransactionTypes() {
  console.log('📊 Checking transaction types in database...\n');
  
  try {
    // Get all unique Register values
    const { data: allData, error } = await supabase
      .from('transaction')
      .select('Register, Register_Ref, Date')
      .limit(2000);
    
    if (error) throw error;
    
    console.log(`Total records fetched: ${allData.length}\n`);
    
    // Count by type
    const newTechs = allData.filter(item => 
      String(item.Register || '').includes('างใหม่')
    );
    
    const resigned = allData.filter(item => 
      String(item.Register || '').includes('ช่างลาออก')
    );
    
    const others = allData.filter(item => {
      const register = String(item.Register || '');
      return !register.includes('างใหม่') && !register.includes('ช่างลาออก');
    });
    
    console.log('📊 Transaction Types:');
    console.log('═'.repeat(60));
    console.log(`ช่างใหม่:        ${newTechs.length} records`);
    console.log(`ช่างลาออก:      ${resigned.length} records`);
    console.log(`อื่นๆ:          ${others.length} records`);
    console.log(`รวม:            ${newTechs.length + resigned.length + others.length} records`);
    console.log('═'.repeat(60));
    
    if (others.length > 0) {
      console.log('\n⚠️  Found OTHER transaction types:');
      console.log('═'.repeat(60));
      
      // Group by Register value
      const registerTypes = {};
      others.forEach(item => {
        const register = String(item.Register || '');
        if (!registerTypes[register]) {
          registerTypes[register] = [];
        }
        registerTypes[register].push(item);
      });
      
      Object.keys(registerTypes).forEach(register => {
        console.log(`\n"${register}": ${registerTypes[register].length} records`);
        console.log('Sample records:');
        registerTypes[register].slice(0, 3).forEach(item => {
          console.log(`  - Date: ${item.Date}, Register_Ref: ${item.Register_Ref}`);
        });
      });
    }
    
    // Get exact counts from DB
    console.log('\n\n📊 Exact counts from Supabase:');
    console.log('═'.repeat(60));
    
    const { count: total } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true });
    
    const { count: newCount } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true })
      .ilike('Register', '%างใหม่%');
    
    const { count: resignedCount } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true })
      .ilike('Register', '%ช่างลาออก%');
    
    console.log(`Total:          ${total}`);
    console.log(`ช่างใหม่:        ${newCount}`);
    console.log(`ช่างลาออก:      ${resignedCount}`);
    console.log(`Sum (New+Res):  ${newCount + resignedCount}`);
    console.log(`Difference:     ${total - (newCount + resignedCount)}`);
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTransactionTypes();
