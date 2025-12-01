const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bxohkukccbuzrxrsuhrq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4b2hrdWtjY2J1enJ4cnN1aHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDc5MzI0NiwiZXhwIjoyMDQ2MzY5MjQ2fQ.bTL45QpYlmIHzor4SWJSn0HRZXzAZpQ6lqt7yuuQTKY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRegisterValues() {
  console.log('Fetching all unique Register values from transaction table...\n');
  
  // Fetch all Register values with pagination
  let allData = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('transaction')
      .select('Register')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.log('Error:', error);
      return;
    }
    
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    console.log(`Fetched ${allData.length} records...`);
    
    if (data.length < batchSize) break;
    from += batchSize;
  }
  
  // Get unique values
  const unique = [...new Set(allData.map(d => d.Register))].sort();
  
  console.log('\n========================================');
  console.log('All unique Register values:');
  console.log('========================================\n');
  
  unique.forEach((v, i) => {
    console.log(`${i + 1}. "${v}"`);
  });
  
  console.log('\n========================================');
  console.log(`Total unique Register values: ${unique.length}`);
  console.log(`Total records: ${allData.length}`);
  console.log('========================================');
  
  // Count each value
  console.log('\n========================================');
  console.log('Count per Register value:');
  console.log('========================================\n');
  
  const counts = {};
  allData.forEach(d => {
    const val = d.Register || '(null)';
    counts[val] = (counts[val] || 0) + 1;
  });
  
  // Sort by count desc
  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  sortedCounts.forEach(([val, count], i) => {
    console.log(`${i + 1}. "${val}": ${count} records`);
  });
}

checkRegisterValues();
