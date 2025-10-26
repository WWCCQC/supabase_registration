// Check real data from Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function checkRealData() {
  console.log('🔍 Checking REAL Data from Supabase\n');
  console.log('=' .repeat(100));

  try {
    // Fetch all technicians with all relevant fields
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    console.log('📊 Fetching all technicians with full details...\n');
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('national_id, full_name, rsm, provider, work_type, workgroup_status')
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

    console.log(`\n✅ Total records in database: ${allData.length}`);
    
    // Show workgroup_status breakdown
    const statusCount = {};
    allData.forEach(row => {
      const status = row.workgroup_status || "null/empty";
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    console.log('\n📊 Workgroup Status Breakdown:');
    Object.entries(statusCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count} คน`);
      });

    // Filter for หัวหน้า
    const headsOnly = allData.filter(row => {
      const status = row.workgroup_status || "";
      return status === "หัวหน้า" || status === "หัวหน้" || status.startsWith("หัวหน");
    });

    console.log(`\n👥 Total หัวหน้ากอง: ${headsOnly.length} คน`);

    // Show RSM breakdown
    console.log('\n' + '=' .repeat(100));
    console.log('📊 BREAKDOWN BY RSM (จำนวนหัวหน้ากองแต่ละ RSM)');
    console.log('=' .repeat(100));

    const rsmBreakdown = {};
    headsOnly.forEach(row => {
      const rsm = row.rsm || "No RSM";
      if (!rsmBreakdown[rsm]) {
        rsmBreakdown[rsm] = {
          total: 0,
          byProvider: {},
          byWorkType: {}
        };
      }
      rsmBreakdown[rsm].total++;
      
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      
      rsmBreakdown[rsm].byProvider[provider] = (rsmBreakdown[rsm].byProvider[provider] || 0) + 1;
      rsmBreakdown[rsm].byWorkType[workType] = (rsmBreakdown[rsm].byWorkType[workType] || 0) + 1;
    });

    // Sort RSMs
    const sortedRsms = Object.keys(rsmBreakdown).sort();
    
    console.log('\nRSM Summary:');
    sortedRsms.forEach(rsm => {
      const data = rsmBreakdown[rsm];
      console.log(`\n${rsm} (Total: ${data.total})`);
      console.log('  Providers:');
      Object.entries(data.byProvider).forEach(([provider, count]) => {
        console.log(`    - ${provider}: ${count}`);
      });
      console.log('  Work Types:');
      Object.entries(data.byWorkType).forEach(([workType, count]) => {
        console.log(`    - ${workType}: ${count}`);
      });
    });

    // Detailed breakdown by RSM x Provider x WorkType
    console.log('\n' + '=' .repeat(100));
    console.log('📊 DETAILED BREAKDOWN: RSM x Provider x WorkType (ตามที่แสดงในตาราง)');
    console.log('=' .repeat(100));

    const detailedBreakdown = {};
    headsOnly.forEach(row => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      const nationalId = row.national_id || "";

      if (!detailedBreakdown[rsm]) {
        detailedBreakdown[rsm] = {};
      }

      const key = `${provider}_${workType}`;
      if (!detailedBreakdown[rsm][key]) {
        detailedBreakdown[rsm][key] = new Set();
      }
      
      if (nationalId && nationalId !== "null" && nationalId !== "undefined") {
        detailedBreakdown[rsm][key].add(nationalId);
      }
    });

    // Convert to counts and calculate totals
    const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
    const workTypes = ['Installation', 'Repair'];

    console.log('\nTable Format (RSM | Grand Total | WW-Provider Total | WW-I | WW-R | TT Total | TT-I | TT-R | TK Total | TK-I | TK-R):');
    console.log('-'.repeat(100));

    // Grand Total row first
    let grandTotal = 0;
    const providerTotals = {};
    const providerWorkTypeTotals = {};

    providers.forEach(provider => {
      providerTotals[provider] = 0;
      providerWorkTypeTotals[provider] = {};
      workTypes.forEach(workType => {
        providerWorkTypeTotals[provider][workType] = 0;
      });
    });

    sortedRsms.forEach(rsm => {
      let rsmTotal = 0;
      const rsmProviderTotals = {};

      providers.forEach(provider => {
        rsmProviderTotals[provider] = 0;
        workTypes.forEach(workType => {
          const key = `${provider}_${workType}`;
          const count = detailedBreakdown[rsm]?.[key]?.size || 0;
          rsmProviderTotals[provider] += count;
          providerTotals[provider] += count;
          providerWorkTypeTotals[provider][workType] += count;
          rsmTotal += count;
        });
      });

      grandTotal += rsmTotal;

      // Print row
      let row = `${rsm.padEnd(20)} | ${String(rsmTotal).padStart(5)} | `;
      
      providers.forEach(provider => {
        const pTotal = rsmProviderTotals[provider];
        const pInstall = detailedBreakdown[rsm]?.[`${provider}_Installation`]?.size || 0;
        const pRepair = detailedBreakdown[rsm]?.[`${provider}_Repair`]?.size || 0;
        row += `${String(pTotal).padStart(5)} | ${String(pInstall).padStart(4)} | ${String(pRepair).padStart(4)} | `;
      });

      console.log(row);
    });

    // Grand Total row
    console.log('-'.repeat(100));
    let grandRow = `${'Grand Total'.padEnd(20)} | ${String(grandTotal).padStart(5)} | `;
    providers.forEach(provider => {
      const pTotal = providerTotals[provider];
      const pInstall = providerWorkTypeTotals[provider]['Installation'];
      const pRepair = providerWorkTypeTotals[provider]['Repair'];
      grandRow += `${String(pTotal).padStart(5)} | ${String(pInstall).padStart(4)} | ${String(pRepair).padStart(4)} | `;
    });
    console.log(grandRow);

    console.log('\n' + '=' .repeat(100));
    console.log('✅ SUMMARY');
    console.log('=' .repeat(100));
    console.log(`Total หัวหน้ากอง (Unique): ${grandTotal} คน`);
    console.log('\nBy Provider:');
    providers.forEach(provider => {
      console.log(`  ${provider}: ${providerTotals[provider]} คน (Installation: ${providerWorkTypeTotals[provider]['Installation']}, Repair: ${providerWorkTypeTotals[provider]['Repair']})`);
    });

    // Check for people with multiple positions
    console.log('\n' + '=' .repeat(100));
    console.log('🔍 Checking for people with multiple head positions');
    console.log('=' .repeat(100));

    const nationalIdPositions = {};
    headsOnly.forEach(row => {
      const nationalId = row.national_id || "";
      if (!nationalId || nationalId === "null" || nationalId === "undefined") return;

      if (!nationalIdPositions[nationalId]) {
        nationalIdPositions[nationalId] = {
          name: row.full_name,
          positions: []
        };
      }
      nationalIdPositions[nationalId].positions.push({
        rsm: row.rsm,
        provider: row.provider,
        work_type: row.work_type
      });
    });

    const multiplePositions = Object.entries(nationalIdPositions)
      .filter(([id, data]) => data.positions.length > 1)
      .sort((a, b) => b[1].positions.length - a[1].positions.length);

    if (multiplePositions.length > 0) {
      console.log(`\n⚠️ Found ${multiplePositions.length} people with multiple head positions:`);
      multiplePositions.slice(0, 10).forEach(([nationalId, data]) => {
        console.log(`\n  ${data.name} (ID: ${nationalId}) - ${data.positions.length} positions:`);
        data.positions.forEach(pos => {
          console.log(`    - ${pos.rsm} | ${pos.provider} | ${pos.work_type}`);
        });
      });
    } else {
      console.log('\n✅ No people with multiple head positions found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRealData();
