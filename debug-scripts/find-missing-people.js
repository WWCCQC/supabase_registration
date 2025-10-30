// Find missing 18 people in workgroup count
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function findMissingPeople() {
  console.log('🔍 Finding Missing 18 People in Workgroup Count\n');
  console.log('=' .repeat(100));

  try {
    // Fetch all technicians
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
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
      
      if (pageData.length < pageSize) break;
      page++;
    }

    console.log(`✅ Total records: ${allData.length}\n`);

    // Filter for หัวหน้า
    const headsOnly = allData.filter(row => {
      const status = row.workgroup_status || "";
      return status === "หัวหน้า" || status === "หัวหน้" || status.startsWith("หัวหน");
    });

    console.log(`👥 Total heads (by status filter): ${headsOnly.length}\n`);

    // Check national_id issues
    const headsWithNationalId = headsOnly.filter(row => {
      const nationalId = row.national_id || "";
      return nationalId && nationalId !== "null" && nationalId !== "undefined";
    });

    const headsWithoutNationalId = headsOnly.filter(row => {
      const nationalId = row.national_id || "";
      return !nationalId || nationalId === "null" || nationalId === "undefined";
    });

    console.log(`✅ Heads WITH valid national_id: ${headsWithNationalId.length}`);
    console.log(`❌ Heads WITHOUT valid national_id: ${headsWithoutNationalId.length}\n`);

    if (headsWithoutNationalId.length > 0) {
      console.log('🔍 People without valid national_id:');
      console.log('=' .repeat(100));
      headsWithoutNationalId.forEach((person, index) => {
        console.log(`${index + 1}. ${person.full_name || 'NO NAME'}`);
        console.log(`   National ID: "${person.national_id}"`);
        console.log(`   RSM: ${person.rsm}`);
        console.log(`   Provider: ${person.provider}`);
        console.log(`   Work Type: ${person.work_type}`);
        console.log('');
      });
    }

    // Check for duplicate national_id
    const nationalIdCount = {};
    headsWithNationalId.forEach(row => {
      const nationalId = row.national_id;
      nationalIdCount[nationalId] = (nationalIdCount[nationalId] || 0) + 1;
    });

    const duplicateIds = Object.entries(nationalIdCount).filter(([id, count]) => count > 1);
    
    if (duplicateIds.length > 0) {
      console.log('\n⚠️ Duplicate National IDs found:');
      console.log('=' .repeat(100));
      duplicateIds.forEach(([id, count]) => {
        console.log(`National ID: ${id} - appears ${count} times`);
        const people = headsWithNationalId.filter(p => p.national_id === id);
        people.forEach(person => {
          console.log(`  - ${person.full_name} | ${person.rsm} | ${person.provider} | ${person.work_type}`);
        });
        console.log('');
      });
    }

    // Calculate unique count
    const uniqueNationalIds = new Set();
    headsWithNationalId.forEach(row => {
      uniqueNationalIds.add(row.national_id);
    });

    console.log('\n' + '=' .repeat(100));
    console.log('SUMMARY');
    console.log('=' .repeat(100));
    console.log(`Total heads (by status):              ${headsOnly.length}`);
    console.log(`Heads with valid national_id:         ${headsWithNationalId.length}`);
    console.log(`Heads without valid national_id:      ${headsWithoutNationalId.length}`);
    console.log(`Unique national_ids:                  ${uniqueNationalIds.size}`);
    console.log(`Duplicate count:                      ${headsWithNationalId.length - uniqueNationalIds.size}`);
    console.log('');
    console.log(`Expected (should be in API):          1788`);
    console.log(`Actually returned by API:             1770`);
    console.log(`Missing:                              ${1788 - 1770} people`);
    console.log('');
    
    if (uniqueNationalIds.size === 1770) {
      console.log('✅ CONFIRMED: API returns unique count correctly!');
      console.log(`   The ${headsWithoutNationalId.length} people without valid national_id are being skipped.`);
    } else if (uniqueNationalIds.size === 1788) {
      console.log('❌ PROBLEM: Unique count is 1788, but API returns 1770');
      console.log('   There might be a filtering issue in the API.');
    } else {
      console.log(`❓ UNEXPECTED: Unique count is ${uniqueNationalIds.size}, different from both 1770 and 1788`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findMissingPeople();
