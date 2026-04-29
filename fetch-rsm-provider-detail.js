// ดึงข้อมูล RSM Provider Distribution จาก Supabase แบบละเอียด
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bxohkukccbuzrxrsuhrq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4b2hrdWtjY2J1enJ4cnN1aHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDc5MzI0NiwiZXhwIjoyMDQ2MzY5MjQ2fQ.bTL45QpYlmIHzor4SWJSn0HRZXzAZpQ6lqt7yuuQTKY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchRSMProviderData() {
  console.log('📊 ดึงข้อมูล RSM Provider Distribution จาก Supabase');
  console.log('='.repeat(120));
  
  try {
    // 1. ดึงข้อมูลทั้งหมด
    console.log('\n📥 กำลังดึงข้อมูล...\n');
    
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type, national_id')
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error('Error:', error);
        return;
      }
      
      if (!data || data.length === 0) break;
      
      allData.push(...data);
      from += pageSize;
      
      if (data.length < pageSize) break;
    }
    
    console.log(`✅ ดึงข้อมูลได้ทั้งหมด: ${allData.length.toLocaleString()} records\n`);
    
    // 2. จัดกลุ่มข้อมูล
    const grouped = {};
    const providerTotals = {
      'เถ้าแก่เทค': { Installation: new Set(), Repair: new Set(), total: new Set() },
      'True Tech': { Installation: new Set(), Repair: new Set(), total: new Set() },
      'WW-Provider': { Installation: new Set(), Repair: new Set(), total: new Set() }
    };
    
    allData.forEach(row => {
      const rsm = String(row.rsm || '').trim();
      const provider = String(row.provider || '').trim();
      const workType = String(row.work_type || '').trim();
      const nationalId = String(row.national_id || '').trim();
      
      // Skip invalid data
      if (!nationalId || nationalId === 'null' || nationalId === 'undefined') return;
      if (!provider || provider === 'null' || provider === 'undefined') return;
      if (!['WW-Provider', 'True Tech', 'เถ้าแก่เทค'].includes(provider)) return;
      
      const rsmKey = (!rsm || rsm === 'null' || rsm === 'undefined') ? 'No RSM' : rsm;
      
      // Initialize RSM group
      if (!grouped[rsmKey]) {
        grouped[rsmKey] = {
          'เถ้าแก่เทค': { Installation: new Set(), Repair: new Set(), total: new Set() },
          'True Tech': { Installation: new Set(), Repair: new Set(), total: new Set() },
          'WW-Provider': { Installation: new Set(), Repair: new Set(), total: new Set() }
        };
      }
      
      // Add to appropriate set
      if (workType === 'Installation') {
        grouped[rsmKey][provider].Installation.add(nationalId);
      } else if (workType === 'Repair') {
        grouped[rsmKey][provider].Repair.add(nationalId);
      }
      grouped[rsmKey][provider].total.add(nationalId);
      
      // Add to grand totals
      if (workType === 'Installation') {
        providerTotals[provider].Installation.add(nationalId);
      } else if (workType === 'Repair') {
        providerTotals[provider].Repair.add(nationalId);
      }
      providerTotals[provider].total.add(nationalId);
    });
    
    // 3. แสดงผลในรูปแบบตาราง
    console.log('┌─────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ RSM             │  เถ้าแก่เทค      │   True Tech      │        WW-Provider       │  รวม │');
    console.log('│                 │ Install  Repair  │ Install  Repair  │ Install  Repair  │ รวม │      │');
    console.log('├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤');
    
    // Sort RSMs
    const rsmList = Object.keys(grouped).filter(r => r !== 'No RSM').sort();
    const totals = { TG_I: 0, TG_R: 0, TG_T: 0, TT_I: 0, TT_R: 0, TT_T: 0, WW_I: 0, WW_R: 0, WW_T: 0, grand: 0 };
    
    rsmList.forEach(rsm => {
      const g = grouped[rsm];
      
      const tg_i = g['เถ้าแก่เทค'].Installation.size;
      const tg_r = g['เถ้าแก่เทค'].Repair.size;
      const tg_t = g['เถ้าแก่เทค'].total.size;
      
      const tt_i = g['True Tech'].Installation.size;
      const tt_r = g['True Tech'].Repair.size;
      const tt_t = g['True Tech'].total.size;
      
      const ww_i = g['WW-Provider'].Installation.size;
      const ww_r = g['WW-Provider'].Repair.size;
      const ww_t = g['WW-Provider'].total.size;
      
      const rowTotal = tg_t + tt_t + ww_t;
      
      totals.TG_I += tg_i;
      totals.TG_R += tg_r;
      totals.TG_T += tg_t;
      totals.TT_I += tt_i;
      totals.TT_R += tt_r;
      totals.TT_T += tt_t;
      totals.WW_I += ww_i;
      totals.WW_R += ww_r;
      totals.WW_T += ww_t;
      totals.grand += rowTotal;
      
      console.log(`│ ${rsm.padEnd(15)} │ ${String(tg_i).padStart(4)}  ${String(tg_r).padStart(6)}  │ ${String(tt_i).padStart(7)}  ${String(tt_r).padStart(6)}  │ ${String(ww_i).padStart(7)}  ${String(ww_r).padStart(6)}  │ \x1b[43m\x1b[30m${String(ww_t).padStart(4)}\x1b[0m │ ${String(rowTotal).padStart(4)} │`);
    });
    
    console.log('├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤');
    console.log(`│ \x1b[1mผลรวม\x1b[0m           │ ${String(totals.TG_I).padStart(4)}  ${String(totals.TG_R).padStart(6)}  │ ${String(totals.TT_I).padStart(7)}  ${String(totals.TT_R).padStart(6)}  │ ${String(totals.WW_I).padStart(7)}  ${String(totals.WW_R).padStart(6)}  │ \x1b[43m\x1b[30m\x1b[1m${String(totals.WW_T).padStart(4)}\x1b[0m │ ${String(totals.grand).padStart(4)} │`);
    console.log('└─────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘');
    
    // 4. แสดงสรุป WW-Provider (highlight)
    console.log('\n🎯 สรุป WW-Provider (ตรงกับคอลัมน์สีเหลืองในรูป):');
    console.log('='.repeat(120));
    console.log(`📊 WW-Provider Installation: ${totals.WW_I.toLocaleString()} คน`);
    console.log(`📊 WW-Provider Repair:       ${totals.WW_R.toLocaleString()} คน`);
    console.log(`📊 \x1b[43m\x1b[30m\x1b[1mWW-Provider รวม:          ${totals.WW_T.toLocaleString()} คน\x1b[0m ⭐ (นี่คือตัวเลขที่ควรแสดงในกราฟ)`);
    
    // 5. เปรียบเทียบกับกราฟ
    console.log('\n🔍 เปรียบเทียบ:');
    console.log('='.repeat(120));
    console.log(`ข้อมูลจาก Supabase (unique national_id):  ${totals.WW_T.toLocaleString()}`);
    console.log(`ที่แสดงในกราฟ (จากรูป):                    2,086`);
    
    if (totals.WW_T === 2095) {
      console.log(`\n✅ ข้อมูลถูกต้อง! ควรแสดง ${totals.WW_T.toLocaleString()} ในกราฟ`);
    } else if (totals.WW_T === 2086) {
      console.log(`\n⚠️  ตรงกับกราฟปัจจุบัน แต่ควรจะมากกว่านี้`);
    } else {
      console.log(`\n❌ ไม่ตรงกับทั้ง 2,095 และ 2,086`);
      console.log(`   ข้อมูลจริง = ${totals.WW_T.toLocaleString()}`);
    }
    
    // 6. แสดงรายละเอียดแต่ละ RSM
    console.log('\n📋 รายละเอียดแต่ละ RSM (WW-Provider รวม):');
    console.log('='.repeat(120));
    rsmList.forEach(rsm => {
      const count = grouped[rsm]['WW-Provider'].total.size;
      console.log(`${rsm.padEnd(20)}: ${String(count).padStart(4)} คน`);
    });
    
    console.log('\n' + '='.repeat(120));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fetchRSMProviderData();
