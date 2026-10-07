import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { importFile } from '../lib/allconnectAppend.mjs';

// Explicit --commit required. Default is a read-only preview.
const [filePath, mode = '--preview', sourceId = 'local'] = process.argv.slice(2);
if (!filePath || !['--preview', '--commit'].includes(mode) || process.argv.length > 5) {
  throw new Error('Usage: node --experimental-strip-types scripts/import-allconnect-new-dates.mjs file.csv [--preview|--commit] [source-id]');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env.local'), quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing server database configuration');
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(180000) }) },
});
let lastProgress = -1;
try {
  const result = await importFile({ db, filePath, sourceId, commit: mode === '--commit', onProgress: event => {
    if (event.phase === 'staging') {
      const percent = Math.floor(event.staged * 10 / Math.max(1, event.expected));
      if (percent === lastProgress) return;
      lastProgress = percent;
    }
    console.log(JSON.stringify(event));
  } });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exitCode = 1;
}
