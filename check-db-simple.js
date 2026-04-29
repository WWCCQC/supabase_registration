const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://sggunyytungtyhezchft.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZ3VueXl0dW5ndHloZXpjaGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTQzMjU5MywiZXhwIjoyMDcxMDA4NTkzfQ.NA8WAm2UPi5b1PNk44ZkAkitIxaPkcQ2mg6kcjNCMac'
);

async function check() {
  // Try a simple select first
  const { data, error, count } = await supabase
    .from('technicians')
    .select('id, CBM', { count: 'exact' })
    .limit(5);

  console.log('Error:', error);
  console.log('Count:', count);
  console.log('Data:', data);

  // Try using the correct table name (maybe it changed)
  const { data: d2, error: e2 } = await supabase
    .from('technicians')
    .select('CBM')
    .not('CBM', 'is', null)
    .limit(3);
  console.log('\nNon-null CBM:', d2, 'Error:', e2);
}

check();
