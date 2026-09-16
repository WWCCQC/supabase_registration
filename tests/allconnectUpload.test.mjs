import assert from 'node:assert/strict';
import test from 'node:test';
import * as upload from '../lib/allconnectUpload.ts';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server.js';
import {
  ALLCONNECT_HEADERS,
  MAX_ALLCONNECT_FILE_SIZE,
  calculateUploadPercent,
  normalizeAllconnectRow,
  validateAllconnectHeaders,
  validateUploadFile,
} from '../lib/allconnectUpload.ts';

test('canonical Allconnect contract contains the 103 ordered source headers', () => {
  assert.equal(ALLCONNECT_HEADERS.length, 103);
  assert.deepEqual(ALLCONNECT_HEADERS.slice(0, 4), ['SECTION', 'SGMD', 'GMD', 'RNSO']);
  assert.deepEqual(ALLCONNECT_HEADERS.slice(-4), ['TDS_REGION', 'TDS_PROVINCE', 'L2_PORT', 'FUSION_SPLICE']);
});

test('header validation accepts a BOM and rejects structural differences', () => {
  assert.deepEqual(validateAllconnectHeaders(['\uFEFFSECTION', ...ALLCONNECT_HEADERS.slice(1)]), { ok: true });
  assert.equal(validateAllconnectHeaders(ALLCONNECT_HEADERS.slice(0, -1)).ok, false);
  assert.equal(validateAllconnectHeaders([...ALLCONNECT_HEADERS, 'EXTRA']).ok, false);
  assert.equal(validateAllconnectHeaders([ALLCONNECT_HEADERS[1], ALLCONNECT_HEADERS[0], ...ALLCONNECT_HEADERS.slice(2)]).ok, false);
  assert.equal(validateAllconnectHeaders([ALLCONNECT_HEADERS[0], ALLCONNECT_HEADERS[0], ...ALLCONNECT_HEADERS.slice(2)]).ok, false);
});

test('row normalization emits every canonical field as text and no unknown fields', () => {
  const row = normalizeAllconnectRow({ SECTION: 'BMA', SGMD: 1, UNKNOWN: 'drop' });
  assert.deepEqual(Object.keys(row), [...ALLCONNECT_HEADERS]);
  assert.equal(row.SECTION, 'BMA');
  assert.equal(row.SGMD, '1');
  assert.equal(row.GMD, '');
  assert.equal('UNKNOWN' in row, false);
});

test('file validation permits txt and csv within 200 MB', () => {
  assert.doesNotThrow(() => validateUploadFile({ name: 'allconnect.txt', size: 41_013_417 }));
  assert.doesNotThrow(() => validateUploadFile({ name: 'allconnect.csv', size: MAX_ALLCONNECT_FILE_SIZE }));
  assert.throws(() => validateUploadFile({ name: 'allconnect.xlsx', size: 1 }), /txt.*csv/i);
  assert.throws(() => validateUploadFile({ name: 'allconnect.csv', size: MAX_ALLCONNECT_FILE_SIZE + 1 }), /200 MB/);
  assert.throws(() => validateUploadFile({ name: 'allconnect.csv', size: 0 }), /empty/i);
});

test('progress reserves the final five percent for database replacement', () => {
  assert.equal(calculateUploadPercent(0, 1000), 0);
  assert.equal(calculateUploadPercent(500, 1000), 48);
  assert.equal(calculateUploadPercent(1000, 1000), 95);
  assert.equal(calculateUploadPercent(2000, 1000), 95);
});

const batchId = '11111111-1111-4111-8111-111111111111';
const canonicalRow = () => Object.fromEntries(ALLCONNECT_HEADERS.map(header => [header, '']));

test('action parser accepts only the four exact action strings', () => {
  assert.equal(typeof upload.parseUploadAction, 'function');
  for (const action of ['start', 'chunk', 'commit', 'abort']) {
    assert.equal(upload.parseUploadAction(action), action);
  }
  for (const action of [undefined, null, {}, [], 1, 'START', ' start', 'start\n', 'delete', new String('start')]) {
    assert.throws(() => upload.parseUploadAction(action), /action/i);
  }
});

test('chunk validation accepts 1 through 200 canonical rows and normalizes text', () => {
  assert.equal(typeof upload.validateChunkPayload, 'function');
  const row = { ...canonicalRow(), SECTION: null, SGMD: 123, HANDLER_ID: '00123' };
  for (const size of [1, 2, 200]) {
    const result = upload.validateChunkPayload({ batchId, startRow: 201, rows: Array(size).fill(row) });
    assert.equal(result.batchId, batchId);
    assert.equal(result.startRow, 201);
    assert.equal(result.rows.length, size);
    assert.deepEqual(Object.keys(result.rows[0]), [...ALLCONNECT_HEADERS]);
    assert.equal(result.rows[0].SECTION, '');
    assert.equal(result.rows[0].SGMD, '123');
    assert.equal(result.rows[0].HANDLER_ID, '00123');
    assert.equal(row.SECTION, null);
  }
});

test('chunk validation rejects non-canonical UUIDs and invalid payload containers', () => {
  assert.equal(typeof upload.validateChunkPayload, 'function');
  for (const value of [null, undefined, [], 'chunk', 1]) {
    assert.throws(() => upload.validateChunkPayload(value), /payload/i);
  }
  for (const id of [null, 1, 'bad', batchId.replaceAll('-', ''), `{${batchId}}`, `${batchId} `,
    `${batchId}\n`, 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    '11111111-1111-4111-7111-111111111111', '11111111-1111-0111-8111-111111111111']) {
    assert.throws(() => upload.validateChunkPayload({ batchId: id, startRow: 1, rows: [canonicalRow()] }), /batch ID/i);
  }
});

test('chunk row numbers are positive safe integers within the PostgreSQL integer range', () => {
  assert.equal(typeof upload.validateChunkPayload, 'function');
  for (const startRow of [undefined, null, '1', 0, -1, 1.5, NaN, Infinity, 2147483648, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => upload.validateChunkPayload({ batchId, startRow, rows: [canonicalRow()] }), /row/i);
  }
  assert.throws(() => upload.validateChunkPayload({ batchId, startRow: 2147483647, rows: [canonicalRow(), canonicalRow()] }), /row/i);
  assert.equal(upload.validateChunkPayload({ batchId, startRow: 2147483647, rows: [canonicalRow()] }).startRow, 2147483647);
});

test('chunk validation rejects missing, empty, non-array and oversized rows', () => {
  assert.equal(typeof upload.validateChunkPayload, 'function');
  for (const rows of [undefined, null, {}, [], Array(201).fill(canonicalRow())]) {
    assert.throws(() => upload.validateChunkPayload({ batchId, startRow: 1, rows }), /batch size/i);
  }
});

test('every chunk row must have exactly the ordered 103 source keys', () => {
  assert.equal(typeof upload.validateChunkPayload, 'function');
  const entries = Object.entries(canonicalRow());
  for (const row of [null, [], 'row', { HANDLER_ID: '1' },
    Object.fromEntries(entries.slice(1)), { ...canonicalRow(), uuid: batchId },
    Object.fromEntries([entries[1], entries[0], ...entries.slice(2)]),
    Object.fromEntries(entries.map(([key, value]) => [key === 'Shop_code' ? 'SHOP_CODE' : key, value]))]) {
    assert.throws(() => upload.validateChunkPayload({ batchId, startRow: 1, rows: [canonicalRow(), row] }), /row/i);
  }
});

// Run the actual handler and Supabase client; replace only the external HTTP transport.
function loadServerModule(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  if (!existsSync(url)) return {};
  const source = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const require = createRequire(url);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === 'server-only') return {};
    if (name === '@/lib/allconnectUpload') return upload;
    if (name === '@/lib/supabase-admin') return loadServerModule('../lib/supabase-admin.ts');
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const route = loadServerModule('../app/api/allconnect-upload/route.ts');
const testSecret = 'allconnect-route-test-secret-not-a-production-secret';
const snapshot = '2026-09-14T07:34:36.765894+00:00';

function routeHarness(t, responses = []) {
  assert.equal(typeof route.POST, 'function', 'upload POST handler must exist');
  const originalEnv = { ...process.env };
  process.env.JWT_SECRET = testSecret;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://allconnect.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-never-return';
  t.after(() => {
    for (const key of ['JWT_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: new URL(url), ...options, body: options.body ? JSON.parse(options.body) : null });
    assert.ok(responses.length > 0, 'unexpected database request');
    const result = responses.shift();
    if (result instanceof Error) throw result;
    const { status = 200, body = null } = result;
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  });
  const logs = [];
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, (...args) => logs.push(args));
  const sign = (role = 'admin', options = {}) => jwt.sign({ role }, testSecret, { algorithm: 'HS256', expiresIn: '5m', ...options });
  async function post(body, { token = sign(), raw = false } = {}) {
    const response = await route.POST(new NextRequest('http://localhost/api/allconnect-upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `auth-token=${token}` } : {}) },
      body: raw ? body : JSON.stringify(body),
    }));
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
    const text = await response.text();
    assert.doesNotMatch(text, /test-service-key-never-return|database-private-detail|allconnect-route-test-secret/);
    assert.ok(!text.includes(token) || !token);
    return { status: response.status, body: JSON.parse(text) };
  }
  t.after(() => assert.equal(logs.length, 0, 'handler must not log sensitive request or database contents'));
  return { post, calls, sign };
}

test('route runs dynamically on Node and rejects absent, invalid, expired and non-HS256 JWTs', async t => {
  const { post, calls, sign } = routeHarness(t);
  assert.equal(route.runtime, 'nodejs');
  assert.equal(route.dynamic, 'force-dynamic');
  for (const token of [null, 'invalid', sign('admin', { expiresIn: -1 }),
    sign('admin', { algorithm: 'HS384' }), jwt.sign({ role: 'admin' }, 'wrong-secret'),
    sign('admin', { notBefore: '1h' })]) {
    const result = await post({ action: 'start' }, { token });
    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'UNAUTHORIZED');
  }
  assert.equal(calls.length, 0);
});

test('all four actions require role exactly admin before parsing or database access', async t => {
  const { post, calls, sign } = routeHarness(t);
  for (const role of ['manager', 'user', 'Admin', ' admin', ['admin'], null]) {
    for (const action of ['start', 'chunk', 'commit', 'abort']) {
      const result = await post({ action }, { token: sign(role) });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, 'FORBIDDEN');
    }
  }
  assert.equal((await post('{', { token: null, raw: true })).status, 401);
  assert.equal(calls.length, 0);
});

test('missing JWT configuration fails closed without accepting the legacy fallback secret', async t => {
  const { post, calls } = routeHarness(t);
  delete process.env.JWT_SECRET;
  const token = jwt.sign({ role: 'admin' }, 'your-super-secret-jwt-key-change-in-production');
  assert.equal((await post({ action: 'start' }, { token })).status, 500);
  assert.equal(calls.length, 0);
});

test('malformed action and action payloads return safe 400 errors without database access', async t => {
  const { post, calls } = routeHarness(t);
  const malformed = [null, [], 42, {}, { action: 'START' }, { action: 'start\n' },
    { action: 'start', unexpected: true }, { action: 'abort' }, { action: 'abort', batchId: `${batchId}\n` },
    { action: 'abort', batchId: batchId.toUpperCase().replace('11111111', 'AAAAAAAA') },
    { action: 'chunk', batchId, startRow: '1', rows: [canonicalRow()] },
    { action: 'chunk', batchId, startRow: 1, rows: Array(201).fill(canonicalRow()) },
    { action: 'chunk', batchId, startRow: 1, rows: [{ HANDLER_ID: '1' }] },
    { action: 'chunk', batchId, startRow: 1, rows: [canonicalRow()], extra: 1 },
    { action: 'commit', batchId }];
  for (const expectedSnapshot of ['', 0, {}, [], 'yesterday', '2026-02-30T00:00:00Z',
    '2026-09-14', `${snapshot}\n`, '2026-09-14T25:00:00Z']) {
    malformed.push({ action: 'commit', batchId, expectedSnapshot });
  }
  for (const body of malformed) {
    const result = await post(body);
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(result.body.code, 'INVALID_REQUEST');
    assert.match(result.body.error, /[\u0e00-\u0e7f]/);
  }
  assert.equal((await post('{', { raw: true })).status, 400);
  assert.equal(calls.length, 0);
});

test('start cleans only staging older than 24h before capturing the live maximum snapshot', async t => {
  const { post, calls } = routeHarness(t, [{ status: 204 }, { body: [{ updated_at: snapshot }] }]);
  const before = Date.now();
  const result = await post({ action: 'start' });
  assert.equal(result.status, 200);
  assert.match(result.body.batchId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(result.body.expectedSnapshot, snapshot);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url.pathname, '/rest/v1/allconnect_import_rows');
  const cutoff = calls[0].url.searchParams.get('created_at');
  assert.ok(cutoff.startsWith('lt.'));
  assert.ok(Date.parse(cutoff.slice(3)) >= before - 86400000);
  assert.ok(Date.parse(cutoff.slice(3)) <= Date.now() - 86400000);
  assert.equal(calls[1].url.pathname, '/rest/v1/allconnect');
  assert.equal(calls[1].url.searchParams.get('select'), 'updated_at');
  assert.equal(calls[1].url.searchParams.get('order'), 'updated_at.desc.nullslast');
  assert.equal(calls[1].url.searchParams.get('limit'), '1');
});

test('start returns null snapshot when no live timestamp exists', async t => {
  const { post } = routeHarness(t, [{ status: 204 }, { body: [] }, { status: 204 }, { body: [{ updated_at: null }] }]);
  const first = await post({ action: 'start' });
  const second = await post({ action: 'start' });
  assert.equal(first.status, 200);
  assert.equal(first.body.expectedSnapshot, null);
  assert.equal(second.body.expectedSnapshot, null);
  assert.notEqual(first.body.batchId, second.body.batchId);
});

test('chunk inserts normalized staging payloads with sequential row numbers, never upserts', async t => {
  const { post, calls } = routeHarness(t, [{ status: 201 }]);
  const result = await post({ action: 'chunk', batchId, startRow: 201, rows: [
    { ...canonicalRow(), HANDLER_ID: '00123' }, { ...canonicalRow(), SECTION: 42 },
  ] });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { acceptedCount: 2 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url.pathname, '/rest/v1/allconnect_import_rows');
  assert.deepEqual(calls[0].body.map(row => [row.batch_id, row.row_number]), [[batchId, 201], [batchId, 202]]);
  assert.equal(calls[0].body[0].payload.HANDLER_ID, '00123');
  assert.equal(calls[0].body[1].payload.SECTION, '42');
  assert.equal(Object.keys(calls[0].body[0].payload).length, 103);
  assert.ok(!new Headers(calls[0].headers).get('Prefer')?.includes('resolution=merge'));
});

test('commit calls the deployed RPC with unchanged timestamp precision or explicit null', async t => {
  const importedAt = '2026-09-16T06:01:02.123456+00:00';
  const { post, calls } = routeHarness(t, [
    { body: [{ inserted_count: 26780, imported_at: importedAt }] },
    { body: [{ inserted_count: 1, imported_at: importedAt }] },
  ]);
  for (const expectedSnapshot of [snapshot, null]) {
    const result = await post({ action: 'commit', batchId, expectedSnapshot });
    assert.equal(result.status, 200);
    assert.equal(result.body.importedAt, importedAt);
    assert.equal(result.body.insertedCount, expectedSnapshot ? 26780 : 1);
  }
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/replace_allconnect_import');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, { p_batch_id: batchId, p_expected_snapshot: snapshot });
  assert.deepEqual(calls[1].body, { p_batch_id: batchId, p_expected_snapshot: null });
});

test('abort deletes only the requested batch', async t => {
  const { post, calls } = routeHarness(t, [{ status: 204 }]);
  const result = await post({ action: 'abort', batchId });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { success: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url.pathname, '/rest/v1/allconnect_import_rows');
  assert.deepEqual([...calls[0].url.searchParams], [['batch_id', `eq.${batchId}`]]);
});

test('database constraint, stale snapshot and unexpected errors have safe status mappings', async t => {
  const cases = [
    ['commit', '40001', 409, 'STALE_SNAPSHOT'],
    ['commit', '23514', 400, 'INVALID_REQUEST'],
    ['chunk', '23505', 400, 'INVALID_REQUEST'],
    ['chunk', '23514', 400, 'INVALID_REQUEST'],
    ['abort', 'XX000', 500, 'UPLOAD_FAILED'],
    ['chunk', 'XX000', 500, 'UPLOAD_FAILED'],
    ['commit', 'XX000', 500, 'UPLOAD_FAILED'],
    ['start', 'XX000', 500, 'UPLOAD_FAILED'],
  ];
  const { post, calls } = routeHarness(t, cases.map(([, code]) => ({ status: 400,
    body: { code, message: 'database-private-detail', details: 'test-service-key-never-return', hint: null },
  })));
  for (const [action, , status, code] of cases) {
    const body = action === 'start' ? { action } : action === 'chunk'
      ? { action, batchId, startRow: 1, rows: [canonicalRow()] }
      : action === 'commit' ? { action, batchId, expectedSnapshot: snapshot } : { action, batchId };
    const result = await post(body);
    assert.equal(result.status, status);
    assert.equal(result.body.code, code);
    assert.match(result.body.error, /[\u0e00-\u0e7f]/);
  }
  assert.equal(calls.length, cases.length, 'failed start cleanup must stop before snapshot read');
});

test('snapshot read failure, missing RPC result and missing database config return 500', async t => {
  const { post } = routeHarness(t, [
    { status: 204 }, { status: 500, body: { code: 'XX000', message: 'database-private-detail', details: null, hint: null } },
    { body: [] },
  ]);
  assert.equal((await post({ action: 'start' })).status, 500);
  assert.equal((await post({ action: 'commit', batchId, expectedSnapshot: snapshot })).status, 500);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await post({ action: 'abort', batchId })).status, 500);
});
