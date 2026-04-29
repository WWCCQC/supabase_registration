// รอ 2 นาที แล้วทดสอบอีกครั้ง
console.log('⏳ รอ Vercel deploy เสร็จ (30 วินาที)...\n');

setTimeout(async () => {
  console.log('🧪 ทดสอบอีกครั้งหลัง Vercel deploy');
  console.log('='.repeat(80));
  
  try {
    const rsmUrl = 'https://supabase-registration.vercel.app/api/chart/rsm-provider';
    
    console.log('📡 RSM Provider API');
    console.log('-'.repeat(80));
    const response = await fetch(rsmUrl, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const data = await response.json();
    
    if (data.summary) {
      console.log('Summary:');
      data.summary.providerBreakdown?.forEach(p => {
        const emoji = p.provider === 'WW-Provider' ? '🎯' : 
                      p.provider === 'True Tech' ? '📱' : '🏪';
        console.log(`${emoji} ${p.provider.padEnd(20)}: ${p.count.toLocaleString()} (${p.percentage}%)`);
      });
      
      const wwCount = data.summary.providerBreakdown?.find(p => p.provider === 'WW-Provider')?.count || 0;
      
      console.log('\n' + '='.repeat(80));
      if (wwCount === 2095) {
        console.log('✅ สำเร็จ! WW-Provider แสดง 2,095 แล้ว!');
        console.log('💡 กรุณา Hard Refresh browser: Ctrl+Shift+R (Windows) หรือ Cmd+Shift+R (Mac)');
      } else if (wwCount === 2086) {
        console.log('❌ ยังเป็น 2,086 อยู่');
        console.log('💡 Vercel อาจยังไม่ deploy เสร็จ รอ 1-2 นาทีแล้วลองอีกครั้ง');
      } else {
        console.log(`⚠️  ได้ค่าใหม่: ${wwCount}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('💡 ลองอีกครั้งในอีกสักครู่');
  }
}, 30000); // รอ 30 วินาที

console.log('📊 ระหว่างนี้ คุณสามารถ:');
console.log('   1. เปิด https://vercel.com/dashboard ดูสถานะ deployment');
console.log('   2. ตรวจสอบ GitHub Actions');
console.log('   3. Hard Refresh browser (Ctrl+Shift+R)\n');
