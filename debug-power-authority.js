const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://uuazqwnjgvhivgdxmyse.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YXpxd25qZ3ZoaXZnZHhteXNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzQ0Njc5NiwiZXhwIjoyMDQzMDIyNzk2fQ.BYj7sshx9g4oDgGhMGfcjyVBPTOc0Z3hCUAF_VL4kVs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPowerAuthorityData() {
  console.log('🔍 Checking actual power_authority data from Supabase...');
  
  try {
    // ดึงข้อมูลทั้งหมดจาก technician table
    const { data: allData, error: allError } = await supabase
      .from('technician')
      .select('power_authority, rsm')
      .order('power_authority');
    
    if (allError) {
      console.error('❌ Error fetching all data:', allError);
      return;
    }
    
    console.log('📊 Total records:', allData.length);
    
    // นับตาม power_authority values
    const counts = {};
    allData.forEach(row => {
      const pa = row.power_authority || 'null';
      counts[pa] = (counts[pa] || 0) + 1;
    });
    
    console.log('📊 Power Authority counts:');
    Object.keys(counts).sort().forEach(key => {
      console.log(`  ${key}: ${counts[key]}`);
    });
    
    // ตรวจสอบ Yes/No specifically
    const yesCount = allData.filter(row => row.power_authority === 'Yes').length;
    const noCount = allData.filter(row => row.power_authority === 'No').length;
    const nullCount = allData.filter(row => !row.power_authority || row.power_authority === '' || row.power_authority === null).length;
    const otherCount = allData.filter(row => row.power_authority && row.power_authority !== 'Yes' && row.power_authority !== 'No').length;
    
    console.log('\n📊 Summary:');
    console.log(`Yes: ${yesCount}`);
    console.log(`No: ${noCount}`);
    console.log(`Null/Empty: ${nullCount}`);
    console.log(`Other values: ${otherCount}`);
    console.log(`Total: ${yesCount + noCount + nullCount + otherCount}`);
    
    // แสดง sample ของค่าที่ไม่ใช่ Yes/No
    if (otherCount > 0) {
      console.log('\n🔍 Sample of other values:');
      const otherValues = [...new Set(allData
        .filter(row => row.power_authority && row.power_authority !== 'Yes' && row.power_authority !== 'No')
        .map(row => row.power_authority)
      )];
      otherValues.slice(0, 10).forEach(val => {
        console.log(`  "${val}"`);
      });
    }
    
    // ตรวจสอบข้อมูลจาก API endpoint ด้วย
    console.log('\n🔍 Checking data from API endpoint...');
    const fetch = require('node-fetch');
    
    try {
      const response = await fetch('http://localhost:3000/api/chart/rsm-workgroup');
      const apiData = await response.json();
      
      console.log('📊 API Response summary:', apiData.summary);
      console.log('📊 API Chart data length:', apiData.chartData?.length || 0);
      
      if (apiData.chartData && apiData.chartData.length > 0) {
        // นับ Yes/No จาก chartData
        let totalYesFromChart = 0;
        let totalNoFromChart = 0;
        
        apiData.chartData.forEach(item => {
          totalYesFromChart += item.Yes || 0;
          totalNoFromChart += item.No || 0;
        });
        
        console.log(`📊 Chart data totals - Yes: ${totalYesFromChart}, No: ${totalNoFromChart}`);
        
        // เปรียบเทียบกับข้อมูลจริง
        console.log('\n🔍 Comparison:');
        console.log(`Database Yes: ${yesCount} vs Chart Yes: ${totalYesFromChart} (diff: ${Math.abs(yesCount - totalYesFromChart)})`);
        console.log(`Database No: ${noCount} vs Chart No: ${totalNoFromChart} (diff: ${Math.abs(noCount - totalNoFromChart)})`);
      }
      
    } catch (apiError) {
      console.error('❌ API Error:', apiError.message);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkPowerAuthorityData();