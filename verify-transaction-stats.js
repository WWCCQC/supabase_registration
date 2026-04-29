const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyTransactionStats() {
  console.log('📊 Verifying Transaction Statistics from Supabase...\n');
  
  try {
    // 1. Total count of transaction records
    const { count: totalCount, error: e1 } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true });
    
    if (e1) throw e1;
    console.log('✅ Total transaction records:', totalCount);
    
    // 2. Count "ช่างใหม่" using ILIKE
    const { count: newTechCount, error: e2 } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true })
      .ilike('Register', '%างใหม่%');
    
    if (e2) throw e2;
    console.log('✅ ช่างใหม่ (New Technicians):', newTechCount);
    
    // 3. Count "ช่างลาออก" using ILIKE
    const { count: resignedCount, error: e3 } = await supabase
      .from('transaction')
      .select('*', { count: 'exact', head: true })
      .ilike('Register', '%ช่างลาออก%');
    
    if (e3) throw e3;
    console.log('✅ ช่างลาออก (Resigned Technicians):', resignedCount);
    
    // 4. Calculate net change
    const netChange = newTechCount - resignedCount;
    console.log('✅ Net Change:', netChange);
    
    console.log('\n📊 Summary:');
    console.log('═'.repeat(50));
    console.log(`Total Transactions:     ${totalCount}`);
    console.log(`New Technicians:        ${newTechCount}`);
    console.log(`Resigned Technicians:   ${resignedCount}`);
    console.log(`Net Change:             ${netChange >= 0 ? '+' : ''}${netChange}`);
    console.log('═'.repeat(50));
    
    // 5. Sample some records to verify
    console.log('\n📋 Sample New Technician Records:');
    const { data: newSamples, error: e4 } = await supabase
      .from('transaction')
      .select('Register, Register_Ref, Date')
      .ilike('Register', '%างใหม่%')
      .limit(5);
    
    if (e4) throw e4;
    newSamples?.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ${record.Register} (${record.Date})`);
    });
    
    console.log('\n📋 Sample Resigned Technician Records:');
    const { data: resignedSamples, error: e5 } = await supabase
      .from('transaction')
      .select('Register, Register_Ref, Date')
      .ilike('Register', '%ช่างลาออก%')
      .limit(5);
    
    if (e5) throw e5;
    resignedSamples?.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ${record.Register} (${record.Date})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyTransactionStats();
