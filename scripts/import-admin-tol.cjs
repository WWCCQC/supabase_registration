const fs = require('node:fs');
const path = require('node:path');
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const headers = [
  'province', 'depot_code', 'sub_name', 'staff_code', 'staff_name', 'email',
  'phone_no', 'image', 'new_image', 'region', 'admin_status', 'admin_grade',
  'sub_status', 'remark', 'last_update', 'om_name', 'inspection_issue_remark',
  'status_zsmart', 'function_provider', 'function_admin', 'admin_install',
  'admin_repair', 'staff_name_eng', 'training_date',
  'training_attendance_count', 'refresh_attendance_count', 'note', 'start_date',
];

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath || process.argv.length !== 3) {
    throw new Error('Usage: node scripts/import-admin-tol.cjs /absolute/path/to/file.csv');
  }

  const csv = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }
  if (JSON.stringify(parsed.meta.fields) !== JSON.stringify(headers)) {
    throw new Error('CSV headers or order do not match public.admin_tol');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service role key');

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { count, error: countError } = await supabase
    .from('admin_tol').select('*', { count: 'exact', head: true });
  if (countError) throw countError;
  if (count !== 0) {
    throw new Error(`admin_tol has ${count} rows. Clear only the rows with TRUNCATE before re-importing.`);
  }

  for (let i = 0; i < parsed.data.length; i += 100) {
    const chunk = parsed.data.slice(i, i + 100);
    const { error } = await supabase.from('admin_tol').insert(chunk);
    if (error) throw new Error(`Import failed after ${i} rows: ${error.message}`);
  }

  const { count: finalCount, error: verifyError } = await supabase
    .from('admin_tol').select('*', { count: 'exact', head: true });
  if (verifyError) throw verifyError;
  if (finalCount !== parsed.data.length) {
    throw new Error(`Expected ${parsed.data.length} rows, found ${finalCount}`);
  }
  console.log(`Imported and verified ${finalCount} rows in public.admin_tol`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
