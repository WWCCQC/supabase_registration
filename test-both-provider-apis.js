// ทดสอบ API ทั้ง CTM และ RSM Provider ว่าคืนค่าอะไร
async function testBothAPIs() {
  console.log('🧪 ทดสอบทั้ง 2 API Endpoints');
  console.log('='.repeat(80));
  
  try {
    // Test Production URLs
    const ctmUrl = 'https://supabase-registration.vercel.app/api/chart/ctm-provider';
    const rsmUrl = 'https://supabase-registration.vercel.app/api/chart/rsm-provider';
    
    console.log('\n📡 1. CTM Provider API');
    console.log('-'.repeat(80));
    const ctmResponse = await fetch(ctmUrl, { cache: 'no-store' });
    const ctmData = await ctmResponse.json();
    
    if (ctmData.summary) {
      console.log('Summary:');
      ctmData.summary.providerBreakdown?.forEach(p => {
        const emoji = p.provider === 'WW-Provider' ? '🎯' : 
                      p.provider === 'True Tech' ? '📱' : '🏪';
        console.log(`${emoji} ${p.provider.padEnd(20)}: ${p.count.toLocaleString()} (${p.percentage}%)`);
      });
    }
    
    console.log('\n📡 2. RSM Provider API');
    console.log('-'.repeat(80));
    const rsmResponse = await fetch(rsmUrl, { cache: 'no-store' });
    const rsmData = await rsmResponse.json();
    
    if (rsmData.summary) {
      console.log('Summary:');
      rsmData.summary.providerBreakdown?.forEach(p => {
        const emoji = p.provider === 'WW-Provider' ? '🎯' : 
                      p.provider === 'True Tech' ? '📱' : '🏪';
        console.log(`${emoji} ${p.provider.padEnd(20)}: ${p.count.toLocaleString()} (${p.percentage}%)`);
      });
    }
    
    console.log('\n🔍 เปรียบเทียบ:');
    console.log('='.repeat(80));
    
    const ctmWW = ctmData.summary?.providerBreakdown?.find(p => p.provider === 'WW-Provider')?.count || 0;
    const rsmWW = rsmData.summary?.providerBreakdown?.find(p => p.provider === 'WW-Provider')?.count || 0;
    
    const ctmTT = ctmData.summary?.providerBreakdown?.find(p => p.provider === 'True Tech')?.count || 0;
    const rsmTT = rsmData.summary?.providerBreakdown?.find(p => p.provider === 'True Tech')?.count || 0;
    
    const ctmTG = ctmData.summary?.providerBreakdown?.find(p => p.provider === 'เถ้าแก่เทค')?.count || 0;
    const rsmTG = rsmData.summary?.providerBreakdown?.find(p => p.provider === 'เถ้าแก่เทค')?.count || 0;
    
    console.log('WW-Provider:');
    console.log(`  CTM Provider: ${ctmWW.toLocaleString()}`);
    console.log(`  RSM Provider: ${rsmWW.toLocaleString()}`);
    if (ctmWW === rsmWW) {
      console.log(`  ✅ ตรงกัน!`);
    } else {
      console.log(`  ❌ ไม่ตรงกัน! (ต่าง ${Math.abs(ctmWW - rsmWW)} records)`);
    }
    
    console.log('\nTrue Tech:');
    console.log(`  CTM Provider: ${ctmTT.toLocaleString()}`);
    console.log(`  RSM Provider: ${rsmTT.toLocaleString()}`);
    if (ctmTT === rsmTT) {
      console.log(`  ✅ ตรงกัน!`);
    } else {
      console.log(`  ❌ ไม่ตรงกัน! (ต่าง ${Math.abs(ctmTT - rsmTT)} records)`);
    }
    
    console.log('\nเถ้าแก่เทค:');
    console.log(`  CTM Provider: ${ctmTG.toLocaleString()}`);
    console.log(`  RSM Provider: ${rsmTG.toLocaleString()}`);
    if (ctmTG === rsmTG) {
      console.log(`  ✅ ตรงกัน!`);
    } else {
      console.log(`  ❌ ไม่ตรงกัน! (ต่าง ${Math.abs(ctmTG - rsmTG)} records)`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (ctmWW === rsmWW && ctmTT === rsmTT && ctmTG === rsmTG) {
      console.log('✅ ทั้ง 2 API คืนค่าตรงกันแล้ว!');
      console.log('💡 ถ้ายังแสดงไม่ถูก กรุณา Hard Refresh browser (Ctrl+Shift+R)');
    } else {
      console.log('❌ ทั้ง 2 API ยังคืนค่าไม่ตรงกัน');
      console.log('💡 รอ Vercel deploy เสร็จ หรือตรวจสอบโค้ดอีกครั้ง');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testBothAPIs();
