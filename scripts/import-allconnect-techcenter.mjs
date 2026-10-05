import { readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import {
  ALLCONNECT_BATCH_SIZE, normalizeAllconnectRow, validateAllconnectHeaders, validateUploadFile,
} from '../lib/allconnectUpload.ts';

const [filePath, mode] = process.argv.slice(2);
if (!filePath || mode !== '--replace') {
  throw new Error('Usage: node --experimental-strip-types scripts/import-allconnect-techcenter.mjs <file.csv> --replace');
}
dotenv.config({ path: '.env.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing server database configuration');
validateUploadFile({ name: filePath, size: statSync(filePath).size });
const source = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(filePath));
const parsed = Papa.parse(source, {
  header: true, dynamicTyping: false, skipEmptyLines: 'greedy',
  delimitersToGuess: ['|', ',', '\t', ';'],
  transformHeader: (header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header,
});
const validation = validateAllconnectHeaders(parsed.meta.fields ?? []);
if (!validation.ok) throw new Error(validation.message);
if (parsed.errors.length || !parsed.data.length) throw new Error('Invalid or empty CSV');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function checked(request) {
  const result = await request;
  if (result.error) throw new Error(`Database request failed (${result.error.code || 'unknown'})`);
  return result;
}
const { data: snapshot } = await checked(db.from('allconnect').select('updated_at')
  .order('updated_at', { ascending: false }).limit(1));
const batchId = randomUUID();
let nextOffset = 0;
let accepted = 0;
let lastProgress = -1;
console.log(JSON.stringify({ phase: 'validated', rows: parsed.data.length, columns: parsed.meta.fields.length, delimiter: parsed.meta.delimiter }));
try {
  const workers = Array.from({ length: 4 }, async () => {
    while (nextOffset < parsed.data.length) {
      const offset = nextOffset;
      nextOffset += ALLCONNECT_BATCH_SIZE;
      const rows = parsed.data.slice(offset, offset + ALLCONNECT_BATCH_SIZE).map((row, index) => ({
        batch_id: batchId, row_number: offset + index + 1, payload: normalizeAllconnectRow(row),
      }));
      await checked(db.from('allconnect_import_rows').insert(rows));
      accepted += rows.length;
      const progress = Math.floor(accepted * 95 / parsed.data.length / 10) * 10;
      if (progress > lastProgress) {
        lastProgress = progress;
        console.log(JSON.stringify({ phase: 'staging', percent: progress, accepted }));
      }
    }
  });
  const settled = await Promise.allSettled(workers);
  const failure = settled.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  assert.equal(accepted, parsed.data.length);
  console.log(JSON.stringify({ phase: 'commit', percent: 95 }));
  const { data } = await checked(db.rpc('replace_allconnect_import', {
    p_batch_id: batchId, p_expected_snapshot: snapshot[0]?.updated_at ?? null,
  }));
  assert.equal(data[0].inserted_count, parsed.data.length);
  const { count } = await checked(db.from('allconnect').select('uuid', { count: 'exact', head: true }));
  assert.equal(count, parsed.data.length);
  console.log(JSON.stringify({ phase: 'complete', percent: 100, insertedCount: count, importedAt: data[0].imported_at }));
} catch (error) {
  await checked(db.from('allconnect_import_rows').delete().eq('batch_id', batchId));
  throw error;
}
