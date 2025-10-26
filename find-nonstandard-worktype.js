// Find people with non-standard work_type
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findNonStandardWorkType() {
  console.log('🔍 Finding People with Non-Standard work_type\n');

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

    // Filter for หัวหน้า
    const headsOnly = allData.filter(row => {
      const status = row.workgroup_status || "";
      return status === "หัวหน้า" || status === "หัวหน้" || status.startsWith("หัวหน");
    });

    console.log(`Total heads: ${headsOnly.length}\n`);

    // Find heads with non-standard work_type
    const nonStandardWorkType = headsOnly.filter(row => {
      const workType = row.work_type || "";
      return workType !== "Installation" && workType !== "Repair";
    });

    console.log(`Heads with Installation: ${headsOnly.filter(r => r.work_type === "Installation").length}`);
    console.log(`Heads with Repair: ${headsOnly.filter(r => r.work_type === "Repair").length}`);
    console.log(`Heads with OTHER work_type: ${nonStandardWorkType.length}\n`);

    if (nonStandardWorkType.length > 0) {
      console.log('=' .repeat(100));
      console.log(`🔍 ${nonStandardWorkType.length} People with Non-Standard work_type:`);
      console.log('=' .repeat(100));
      
      // Group by work_type value
      const groupedByWorkType = {};
      nonStandardWorkType.forEach(person => {
        const workType = person.work_type === null ? "NULL" : 
                        person.work_type === undefined ? "UNDEFINED" :
                        person.work_type === "" ? "EMPTY STRING" :
                        person.work_type;
        
        if (!groupedByWorkType[workType]) {
          groupedByWorkType[workType] = [];
        }
        groupedByWorkType[workType].push(person);
      });

      Object.entries(groupedByWorkType).forEach(([workType, people]) => {
        console.log(`\nwork_type = "${workType}" (${people.length} คน):`);
        people.slice(0, 5).forEach(person => {
          console.log(`  - ${person.full_name || 'NO NAME'} | ${person.rsm} | ${person.provider}`);
        });
        if (people.length > 5) {
          console.log(`  ... and ${people.length - 5} more`);
        }
      });
    }

    console.log('\n' + '=' .repeat(100));
    console.log('SOLUTION:');
    console.log('=' .repeat(100));
    console.log('We need to count ALL heads regardless of work_type!');
    console.log(`Currently skipping: ${nonStandardWorkType.length} people`);
    console.log(`This matches the missing count: ${1788 - 1770} = 18 people`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findNonStandardWorkType();
