import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { ALLCONNECT_HEADERS } from '../lib/allconnectUpload.ts';

// Explicit opt-in harness: writes only disposable staging rows, never commits a live replacement.
const [baseUrl, envPath] = process.argv.slice(2);
assert.ok(baseUrl && envPath, 'Usage: node --experimental-strip-types tests/allconnect-upload-api-live.mjs BASE_URL ENV_PATH');
const env = parse(readFileSync(envPath));
for (const key of ['JWT_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  assert.ok(env[key], `Missing ${key}`);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sign = (role, options = {}) => jwt.sign({ role }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m', ...options });
const admin = sign('admin');
const batches = [randomUUID(), randomUUID(), randomUUID()];
const [expiredBatch, recentBatch, emptyBatch] = batches;
const row = Object.fromEntries(ALLCONNECT_HEADERS.map(header => [header, '']));
const evidence = [];

async function checked(query) {
  const result = await query;
  assert.ok(!result.error, `Database operation failed (${result.error?.code ?? 'unknown'})`);
  return result;
}

async function liveSnapshot() {
  const { data, count } = await checked(db.from('allconnect').select('updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false, nullsFirst: false }).limit(1));
  return { count, snapshot: data[0]?.updated_at ?? null };
}

async function stagingCount(ids) {
  const { count } = await checked(db.from('allconnect_import_rows').select('*', { count: 'exact', head: true }).in('batch_id', ids));
  return count;
}

async function post(label, body, status, token = admin, raw = false) {
  const response = await fetch(new URL('/api/allconnect-upload', baseUrl), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `auth-token=${token}` } : {}) },
    body: raw ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, status, label);
  const cacheDirectives = response.headers.get('cache-control')?.split(',').map(value => value.trim()) ?? [];
  for (const directive of ['private', 'no-store', 'max-age=0']) assert.ok(cacheDirectives.includes(directive), label);
  const text = await response.text();
  for (const secret of [env.JWT_SECRET, env.SUPABASE_SERVICE_ROLE_KEY, token].filter(Boolean)) {
    assert.equal(text.includes(secret), false, `${label}: secret disclosure`);
  }
  const result = JSON.parse(text);
  if (status >= 400) {
    assert.equal(typeof result.code, 'string', label);
    assert.match(result.error, /[\u0e00-\u0e7f]/, label);
  }
  evidence.push({ check: label, status });
  return result;
}

const before = await liveSnapshot();
try {
  await post('no cookie', { action: 'start' }, 401, null);
  await post('manager', { action: 'start' }, 403, sign('manager'));
  await post('regular user', { action: 'start' }, 403, sign('user'));
  await post('expired JWT', { action: 'start' }, 401, sign('admin', { expiresIn: -1 }));
  await post('non-HS256 JWT', { action: 'start' }, 401, sign('admin', { algorithm: 'HS384' }));
  await checked(db.from('allconnect_import_rows').insert([
    { batch_id: expiredBatch, row_number: 1, payload: row, created_at: new Date(Date.now() - 48 * 3600000).toISOString() },
    { batch_id: recentBatch, row_number: 1, payload: row, created_at: new Date(Date.now() - 23 * 3600000).toISOString() },
  ]));
  const started = await post('admin start', { action: 'start' }, 200);
  assert.match(started.batchId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  batches.push(started.batchId);
  assert.equal(started.expectedSnapshot, before.snapshot);
  assert.equal(await stagingCount([expiredBatch]), 0);
  assert.equal(await stagingCount([recentBatch]), 1);
  evidence.push({ check: '24h cleanup', expiredRows: 0, recentRows: 1 });

  await post('unknown action', { action: 'delete' }, 400);
  await post('malformed JSON', '{', 400, admin, true);
  await post('null payload', null, 400);
  await post('non-canonical batch ID', { action: 'abort', batchId: `${started.batchId}\n` }, 400);
  await post('invalid startRow', { action: 'chunk', batchId: started.batchId, startRow: 0, rows: [row] }, 400);
  await post('201-row chunk', { action: 'chunk', batchId: started.batchId, startRow: 1, rows: Array(201).fill(row) }, 400);
  await post('wrong ordered keys', { action: 'chunk', batchId: started.batchId, startRow: 1,
    rows: [Object.fromEntries(Object.entries(row).reverse())] }, 400);
  await post('missing commit snapshot', { action: 'commit', batchId: emptyBatch }, 400);
  await post('invalid commit snapshot', { action: 'commit', batchId: emptyBatch, expectedSnapshot: '2026-02-30T00:00:00Z' }, 400);
  await post('empty staged commit', { action: 'commit', batchId: emptyBatch, expectedSnapshot: started.expectedSnapshot }, 400);

  const chunk = { action: 'chunk', batchId: started.batchId, startRow: 1, rows: [row, { ...row, HANDLER_ID: 'task-3-test' }] };
  assert.equal((await post('admin chunk', chunk, 200)).acceptedCount, 2);
  const { data: staged } = await checked(db.from('allconnect_import_rows').select('row_number').eq('batch_id', started.batchId).order('row_number'));
  assert.deepEqual(staged.map(item => item.row_number), [1, 2]);
  await post('duplicate row numbers', chunk, 400);
  // Do not probe stale commits here: the deployed RPC's custom 40001 triggers
  // PostgREST retries that survive client cancellation. Route mapping is unit-tested.
  evidence.push({ check: 'live stale commit', notRun: 'Known deployed 40001 retry issue; see task-3-report.md' });
  assert.equal(await stagingCount([started.batchId]), 2);
  await post('admin abort', { action: 'abort', batchId: started.batchId }, 200);
  assert.equal(await stagingCount([started.batchId]), 0);
  assert.equal(await stagingCount([recentBatch]), 1, 'abort must preserve unrelated batches');
  await post('idempotent admin abort', { action: 'abort', batchId: started.batchId }, 200);
} finally {
  await checked(db.from('allconnect_import_rows').delete().in('batch_id', batches));
  const remaining = await stagingCount(batches);
  assert.equal(remaining, 0, 'temporary staging rows must be cleaned');
  const after = await liveSnapshot();
  assert.deepEqual(after, before, 'live Allconnect count and snapshot must remain unchanged');
  console.log(JSON.stringify({ evidence, before, after, temporaryStagingRowsRemaining: remaining }, null, 2));
}
