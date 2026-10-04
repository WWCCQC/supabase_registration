const fs = require('node:fs');
const path = require('node:path');
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const headers = [
  'timestamp', 'national_id', 'full_name', 'depot_code', 'store_code_100xxx',
  'code_39xxx', 'dealer_name', 'phone_no', 'image', 'store_email', 'status',
];

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath || process.argv.length !== 3) {
    throw new Error('Usage: node scripts/import-admin-sale.cjs /absolute/path/to/file.csv');
  }

  const csv = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }
  if (JSON.stringify(parsed.meta.fields) !== JSON.stringify(headers)) {
    throw new Error('CSV headers or order do not match public.admin_sale');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service role key');

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { count, error: countError } = await supabase
    .from('admin_sale').select('*', { count: 'exact', head: true });
  if (countError) throw countError;
  if (count !== 0) {
    throw new Error(`admin_sale has ${count} rows. Clear only rows with TRUNCATE before re-importing.`);
  }

  for (let i = 0; i < parsed.data.length; i += 100) {
    const { error } = await supabase.from('admin_sale').insert(parsed.data.slice(i, i + 100));
    if (error) throw new Error(`Import failed after ${i} rows: ${error.message}`);
  }

  const { count: finalCount, error: verifyError } = await supabase
    .from('admin_sale').select('*', { count: 'exact', head: true });
  if (verifyError) throw verifyError;
  if (finalCount !== parsed.data.length) {
    throw new Error(`Expected ${parsed.data.length} rows, found ${finalCount}`);
  }
  console.log(`Imported and verified ${finalCount} rows in public.admin_sale`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
