const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPowerAuthorityData() {
  console.log('🔍 ตรวจสอบข้อมูล Power Authority จาก Supabase...\n');
  console.log('='.repeat(70));
  
  try {
    // Fetch all data with pagination
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('technicians')
        .select('national_id, power_authority, rsm')
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error('Error:', error);
        return;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`✅ ดึงข้อมูลทั้งหมด: ${allData.length} records\n`);
    
    // Count Yes/No
    let yesCount = 0;
    let noCount = 0;
    let nullCount = 0;
    let otherCount = 0;
    
    const yesSet = new Set();
    const noSet = new Set();
    const otherValues = new Set();
    
    allData.forEach(row => {
      const nationalId = row.national_id;
      const powerAuth = row.power_authority;
      
      if (!powerAuth || powerAuth === null || powerAuth === '') {
        nullCount++;
      } else {
        const cleaned = String(powerAuth).toLowerCase().trim();
        
        if (cleaned === 'yes' || cleaned === 'y') {
          yesCount++;
          yesSet.add(nationalId);
        } else if (cleaned === 'no' || cleaned === 'n') {
          noCount++;
          noSet.add(nationalId);
        } else {
          otherCount++;
          otherValues.add(powerAuth);
        }
      }
    });
    
    console.log('📊 สรุปข้อมูล Power Authority:');
    console.log('='.repeat(70));
    console.log(`🟢 Yes:    ${yesCount.toLocaleString()} records (${yesSet.size.toLocaleString()} unique national_id)`);
    console.log(`🔴 No:     ${noCount.toLocaleString()} records (${noSet.size.toLocaleString()} unique national_id)`);
    console.log(`⚪ Null:   ${nullCount.toLocaleString()} records`);
    console.log(`⚠️  Other:  ${otherCount.toLocaleString()} records`);
    console.log('-'.repeat(70));
    console.log(`📊 รวม:    ${allData.length.toLocaleString()} records`);
    console.log('='.repeat(70));
    
    // Show other values if any
    if (otherValues.size > 0) {
      console.log('\n⚠️  ค่าอื่นๆ ที่พบ:');
      otherValues.forEach(val => {
        const count = allData.filter(r => r.power_authority === val).length;
        console.log(`   "${val}": ${count} records`);
      });
    }
    
    // Count by RSM
    console.log('\n📋 จำนวนแยกตาม RSM:');
    console.log('='.repeat(70));
    
    const byRSM = {};
    allData.forEach(row => {
      const rsm = row.rsm || '(ไม่มี RSM)';
      const powerAuth = row.power_authority;
      
      if (!byRSM[rsm]) {
        byRSM[rsm] = { 
          yes: new Set(), 
          no: new Set(), 
          null: 0, 
          other: 0 
        };
      }
      
      if (!powerAuth || powerAuth === null || powerAuth === '') {
        byRSM[rsm].null++;
      } else {
        const cleaned = String(powerAuth).toLowerCase().trim();
        if (cleaned === 'yes' || cleaned === 'y') {
          byRSM[rsm].yes.add(row.national_id);
        } else if (cleaned === 'no' || cleaned === 'n') {
          byRSM[rsm].no.add(row.national_id);
        } else {
          byRSM[rsm].other++;
        }
      }
    });
    
    console.log('RSM'.padEnd(25) + 'Yes'.padStart(8) + 'No'.padStart(8) + 'Total'.padStart(10));
    console.log('-'.repeat(70));
    
    const sortedRSMs = Object.keys(byRSM).sort((a, b) => {
      const totalA = byRSM[a].yes.size + byRSM[a].no.size;
      const totalB = byRSM[b].yes.size + byRSM[b].no.size;
      return totalB - totalA;
    });
    
    let grandYes = 0;
    let grandNo = 0;
    
    sortedRSMs.forEach(rsm => {
      const yesSize = byRSM[rsm].yes.size;
      const noSize = byRSM[rsm].no.size;
      const total = yesSize + noSize;
      
      grandYes += yesSize;
      grandNo += noSize;
      
      console.log(
        rsm.padEnd(25) +
        yesSize.toString().padStart(8) +
        noSize.toString().padStart(8) +
        total.toString().padStart(10)
      );
    });
    
    console.log('='.repeat(70));
    console.log(
      'GRAND TOTAL'.padEnd(25) +
      grandYes.toString().padStart(8) +
      grandNo.toString().padStart(8) +
      (grandYes + grandNo).toString().padStart(10)
    );
    console.log('='.repeat(70));
    
    console.log('\n💡 Summary for Chart Legend:');
    console.log(`   Yes: ${grandYes.toLocaleString()} คน`);
    console.log(`   No: ${grandNo.toLocaleString()} คน`);
    console.log(`   Total: ${(grandYes + grandNo).toLocaleString()} คน`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPowerAuthorityData();
