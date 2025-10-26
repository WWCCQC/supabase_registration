// Test workgroup count fix - verify unique counting
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Missing environment variables!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE:', supabaseServiceRole ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function testWorkgroupCount() {
  console.log('🔍 Testing Workgroup Count Fix\n');
  console.log('=' .repeat(80));

  try {
    // Fetch all technicians
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    console.log('📊 Fetching all technicians...');
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('rsm, provider, work_type, workgroup_status, national_id')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('❌ Error:', error);
        break;
      }
      
      if (!pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      console.log(`   Batch ${page + 1}: ${pageData.length} records, total: ${allData.length}`);
      
      if (pageData.length < pageSize) break;
      page++;
    }

    console.log(`✅ Total records fetched: ${allData.length}\n`);

    // Filter for หัวหน้า only
    const headsOnly = allData.filter(row => {
      const status = row.workgroup_status || "";
      return status === "หัวหน้า" || status === "หัวหน้" || status.startsWith("หัวหน");
    });

    console.log(`👥 Total workgroup heads: ${headsOnly.length}`);
    console.log(`📊 Sample statuses: ${[...new Set(allData.map(r => r.workgroup_status).filter(Boolean))].slice(0, 10).join(', ')}\n`);

    // Test 1: Count ROWS (old method - wrong)
    console.log('=' .repeat(80));
    console.log('TEST 1: Count ROWS (OLD METHOD - มีปัญหา)');
    console.log('=' .repeat(80));
    
    const rowCountResult = {};
    headsOnly.forEach(row => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";

      if (!rowCountResult[rsm]) rowCountResult[rsm] = {};

      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        rowCountResult[rsm][key] = (rowCountResult[rsm][key] || 0) + 1;
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        rowCountResult[rsm][key] = (rowCountResult[rsm][key] || 0) + 1;
      }
    });

    // Calculate old grand total
    let oldGrandTotal = 0;
    Object.keys(rowCountResult).forEach(rsm => {
      Object.keys(rowCountResult[rsm]).forEach(key => {
        oldGrandTotal += rowCountResult[rsm][key];
      });
    });

    console.log('📊 Sample RSMs (Row Count):');
    Object.keys(rowCountResult).slice(0, 3).forEach(rsm => {
      console.log(`   ${rsm}:`, rowCountResult[rsm]);
    });
    console.log(`\n❌ OLD Grand Total (นับ ROWS): ${oldGrandTotal}`);

    // Test 2: Count UNIQUE national_id (new method - correct)
    console.log('\n' + '=' .repeat(80));
    console.log('TEST 2: Count UNIQUE national_id (NEW METHOD - แก้แล้ว)');
    console.log('=' .repeat(80));

    const uniqueSets = {};
    headsOnly.forEach(row => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      const nationalId = row.national_id || "";

      if (!nationalId || nationalId === "null" || nationalId === "undefined") return;

      if (!uniqueSets[rsm]) uniqueSets[rsm] = {};

      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        if (!uniqueSets[rsm][key]) uniqueSets[rsm][key] = new Set();
        uniqueSets[rsm][key].add(nationalId);
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        if (!uniqueSets[rsm][key]) uniqueSets[rsm][key] = new Set();
        uniqueSets[rsm][key].add(nationalId);
      }
    });

    // Convert Sets to counts
    const uniqueCountResult = {};
    Object.keys(uniqueSets).forEach(rsm => {
      uniqueCountResult[rsm] = {};
      Object.keys(uniqueSets[rsm]).forEach(key => {
        uniqueCountResult[rsm][key] = uniqueSets[rsm][key].size;
      });
    });

    // Calculate new grand total (unique across ALL RSMs)
    const grandTotalSet = new Set();
    headsOnly.forEach(row => {
      const nationalId = row.national_id || "";
      if (nationalId && nationalId !== "null" && nationalId !== "undefined") {
        grandTotalSet.add(nationalId);
      }
    });
    const newGrandTotal = grandTotalSet.size;

    console.log('📊 Sample RSMs (Unique Count):');
    Object.keys(uniqueCountResult).slice(0, 3).forEach(rsm => {
      console.log(`   ${rsm}:`, uniqueCountResult[rsm]);
    });
    console.log(`\n✅ NEW Grand Total (นับ UNIQUE คน): ${newGrandTotal}`);

    // Compare
    console.log('\n' + '=' .repeat(80));
    console.log('COMPARISON (เปรียบเทียบ)');
    console.log('=' .repeat(80));
    console.log(`OLD Method (Rows):   ${oldGrandTotal}`);
    console.log(`NEW Method (Unique): ${newGrandTotal}`);
    console.log(`Difference:          ${oldGrandTotal - newGrandTotal} คน (นับซ้ำ)`);
    console.log(`Duplication Rate:    ${((oldGrandTotal - newGrandTotal) / newGrandTotal * 100).toFixed(2)}%`);

    // Find duplicate examples
    console.log('\n' + '=' .repeat(80));
    console.log('DUPLICATE EXAMPLES (ตัวอย่างคนที่ถูกนับซ้ำ)');
    console.log('=' .repeat(80));

    const nationalIdCount = {};
    headsOnly.forEach(row => {
      const nationalId = row.national_id || "";
      if (nationalId && nationalId !== "null" && nationalId !== "undefined") {
        if (!nationalIdCount[nationalId]) {
          nationalIdCount[nationalId] = [];
        }
        nationalIdCount[nationalId].push({
          rsm: row.rsm,
          provider: row.provider,
          work_type: row.work_type
        });
      }
    });

    const duplicates = Object.entries(nationalIdCount)
      .filter(([id, records]) => records.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    if (duplicates.length > 0) {
      console.log(`\nพบคนที่มีหลายตำแหน่ง: ${Object.entries(nationalIdCount).filter(([id, records]) => records.length > 1).length} คน`);
      console.log('\nTop 5 คนที่มีตำแหน่งหัวหน้ามากที่สุด:');
      duplicates.forEach(([nationalId, records]) => {
        console.log(`\n  National ID: ${nationalId} (${records.length} ตำแหน่ง)`);
        records.forEach(record => {
          console.log(`    - ${record.rsm} | ${record.provider} | ${record.work_type}`);
        });
      });
    } else {
      console.log('✅ ไม่พบคนที่ถูกนับซ้ำ - ทุกคนมีตำแหน่งเดียว');
    }

    // Check specific RSM for details
    console.log('\n' + '=' .repeat(80));
    console.log('DETAILED CHECK: RSM1_BMA-West');
    console.log('=' .repeat(80));

    const rsm1Data = headsOnly.filter(row => row.rsm === "RSM1_BMA-West");
    console.log(`Total rows: ${rsm1Data.length}`);
    
    const rsm1UniqueIds = new Set(rsm1Data.map(r => r.national_id).filter(id => id && id !== "null" && id !== "undefined"));
    console.log(`Unique people: ${rsm1UniqueIds.size}`);
    console.log(`Duplicates in this RSM: ${rsm1Data.length - rsm1UniqueIds.size}`);

    // Break down by provider
    const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
    providers.forEach(provider => {
      const providerData = rsm1Data.filter(r => r.provider === provider);
      const installRows = providerData.filter(r => r.work_type === "Installation");
      const repairRows = providerData.filter(r => r.work_type === "Repair");
      
      const installUnique = new Set(installRows.map(r => r.national_id).filter(Boolean));
      const repairUnique = new Set(repairRows.map(r => r.national_id).filter(Boolean));
      
      console.log(`\n  ${provider}:`);
      console.log(`    Installation: ${installRows.length} rows, ${installUnique.size} unique`);
      console.log(`    Repair: ${repairRows.length} rows, ${repairUnique.size} unique`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWorkgroupCount();
