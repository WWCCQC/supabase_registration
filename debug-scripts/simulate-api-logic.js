// Check if API filtering logic matches reality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simulateAPILogic() {
  console.log('🔍 Simulating EXACT API Logic\n');

  try {
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error } = await supabase
        .from('technicians')
        .select('national_id, full_name, rsm, provider, work_type, workgroup_status')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error || !pageData || pageData.length === 0) break;
      
      allData = [...allData, ...pageData];
      if (pageData.length < pageSize) break;
      page++;
    }

    console.log(`Total records: ${allData.length}`);

    // Step 1: Filter for หัวหน้า (EXACT same as API)
    const headsOnly = allData.filter(row => {
      const status = row.workgroup_status || "";
      return status === "หัวหน้า" || status === "หัวหน้" || status.startsWith("หัวหน");
    });
    console.log(`After หัวหน้า filter: ${headsOnly.length}`);

    // Step 2: Simulate API processing (EXACT same logic)
    const uniqueSets = {};
    let skippedCount = 0;
    const skippedPeople = [];

    headsOnly.forEach(row => {
      const rsm = row.rsm || "Unknown";
      const provider = row.provider || "Unknown";
      const workType = row.work_type || "Unknown";
      const nationalId = row.national_id || "";

      // EXACT same check as API
      if (!nationalId || nationalId === "null" || nationalId === "undefined") {
        skippedCount++;
        skippedPeople.push({...row, reason: 'No valid national_id'});
        return;
      }

      if (!uniqueSets[rsm]) {
        uniqueSets[rsm] = {};
      }

      // EXACT same logic as API
      if (workType === "Installation") {
        const key = `${provider}_Installation`;
        if (!uniqueSets[rsm][key]) {
          uniqueSets[rsm][key] = new Set();
        }
        uniqueSets[rsm][key].add(nationalId);
      } else if (workType === "Repair") {
        const key = `${provider}_Repair`;
        if (!uniqueSets[rsm][key]) {
          uniqueSets[rsm][key] = new Set();
        }
        uniqueSets[rsm][key].add(nationalId);
      } else {
        // ❌ THIS IS THE PROBLEM - people with other work_type are skipped!
        skippedCount++;
        skippedPeople.push({...row, reason: `work_type not Installation/Repair: "${workType}"`});
      }
    });

    // Step 3: Calculate grand total (EXACT same as API)
    const grandTotalSet = new Set();
    headsOnly.forEach(row => {
      const nationalId = row.national_id || "";
      if (nationalId && nationalId !== "null" && nationalId !== "undefined") {
        grandTotalSet.add(nationalId);
      }
    });

    console.log(`\n${'='.repeat(100)}`);
    console.log('SIMULATION RESULTS:');
    console.log('='.repeat(100));
    console.log(`Total heads (status filter):          ${headsOnly.length}`);
    console.log(`Skipped during processing:            ${skippedCount}`);
    console.log(`Grand Total Set size:                 ${grandTotalSet.size}`);
    console.log(`\nExpected API return:                  ${grandTotalSet.size}`);
    console.log(`Actual API return (from console):     1770`);
    console.log(`Difference:                           ${grandTotalSet.size - 1770}`);

    if (skippedPeople.length > 0) {
      console.log(`\n${'='.repeat(100)}`);
      console.log(`SKIPPED PEOPLE (${skippedPeople.length} total):`);
      console.log('='.repeat(100));
      
      // Group by reason
      const byReason = {};
      skippedPeople.forEach(person => {
        if (!byReason[person.reason]) {
          byReason[person.reason] = [];
        }
        byReason[person.reason].push(person);
      });

      Object.entries(byReason).forEach(([reason, people]) => {
        console.log(`\n${reason} (${people.length} คน):`);
        people.slice(0, 10).forEach(person => {
          console.log(`  - ${person.full_name || 'NO NAME'} | RSM: ${person.rsm} | Provider: ${person.provider} | WorkType: "${person.work_type}"`);
        });
        if (people.length > 10) {
          console.log(`  ... and ${people.length - 10} more`);
        }
      });
    }

    // Calculate what SHOULD be counted
    let shouldBeCounted = 0;
    Object.keys(uniqueSets).forEach(rsm => {
      Object.keys(uniqueSets[rsm]).forEach(key => {
        shouldBeCounted += uniqueSets[rsm][key].size;
      });
    });

    console.log(`\n${'='.repeat(100)}`);
    console.log('WHAT IS BEING COUNTED:');
    console.log('='.repeat(100));
    console.log(`Sum of all RSM x Provider x WorkType: ${shouldBeCounted}`);
    console.log(`Grand Total Set (unique across all):  ${grandTotalSet.size}`);
    console.log(`\n⚠️ NOTE: These should be the SAME if no one has multiple positions`);
    console.log(`Difference: ${Math.abs(shouldBeCounted - grandTotalSet.size)}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

simulateAPILogic();
