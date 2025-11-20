// ตรวจสอบจำนวน provider จริงๆ จาก API
async function verifyProviderCounts() {
  console.log('🔍 Verifying provider counts from RSM Provider API...\n');
  
  try {
    const response = await fetch('https://supabase-registration.vercel.app/api/chart/rsm-provider');
    const data = await response.json();
    
    console.log('📊 Current API Response:');
    console.log('================================');
    data.summary.providerBreakdown.forEach(p => {
      console.log(`${p.provider}: ${p.count}`);
    });
    console.log('================================');
    
    console.log('\n📊 Chart Data by RSM:');
    console.log('================================');
    
    const totals = {
      "WW-Provider": 0,
      "True Tech": 0,
      "เถ้าแก่เทค": 0
    };
    
    data.chartData.forEach(row => {
      console.log(`${row.rsm}:`);
      console.log(`  WW-Provider: ${row['WW-Provider']}`);
      console.log(`  True Tech: ${row['True Tech']}`);
      console.log(`  เถ้าแก่เทค: ${row['เถ้าแก่เทค']}`);
      console.log(`  Total: ${row.total}`);
      
      totals["WW-Provider"] += row['WW-Provider'];
      totals["True Tech"] += row['True Tech'];
      totals["เถ้าแก่เทค"] += row['เถ้าแก่เทค'];
    });
    
    console.log('================================');
    console.log('\n📊 Totals from chart data:');
    console.log('================================');
    console.log(`WW-Provider: ${totals["WW-Provider"]}`);
    console.log(`True Tech: ${totals["True Tech"]}`);
    console.log(`เถ้าแก่เทค: ${totals["เถ้าแก่เทค"]}`);
    console.log(`Grand Total: ${totals["WW-Provider"] + totals["True Tech"] + totals["เถ้าแก่เทค"]}`);
    
    console.log('\n📊 Expected values:');
    console.log('================================');
    console.log('WW-Provider: 2,090');
    console.log('True Tech: 824');
    console.log('เถ้าแก่เทค: 52');
    console.log('Grand Total: 2,966');
    
    console.log('\n❌ Differences:');
    console.log('================================');
    console.log(`WW-Provider: ${totals["WW-Provider"] - 2090} (${totals["WW-Provider"] > 2090 ? '+' : ''}${totals["WW-Provider"] - 2090})`);
    console.log(`True Tech: ${totals["True Tech"] - 824} (${totals["True Tech"] > 824 ? '+' : ''}${totals["True Tech"] - 824})`);
    console.log(`เถ้าแก่เทค: ${totals["เถ้าแก่เทค"] - 52} (${totals["เถ้าแก่เทค"] > 52 ? '+' : ''}${totals["เถ้าแก่เทค"] - 52})`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

verifyProviderCounts();
