import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server.js';
import * as compare from '../lib/allconnectCompare.ts';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../app/api/allconnect-compare/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

test('comparison API calls the job dashboard with literal filters and preserves role authorization', async t => {
  const secret = 'allconnect-source-test-secret';
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const status = { summary: { installCount: 2, repairCount: 3, jobCount: 5 } };
  const calls = [];
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name === '@/lib/allconnectCompare') return compare;
    if (name === '@/lib/supabase-admin') return { supabaseAdmin: () => ({
      rpc(...args) {
        calls.push(args);
        return { abortSignal: async () => ({ data: status, error: null }) };
      },
    }) };
    return require(name);
  }, module, module.exports);
  async function get(role, params = 'status=with_work&rbm=R1&month=2026-09') {
    const cookie = role ? `auth-token=${jwt.sign({ role }, secret, { algorithm: 'HS256', expiresIn: '5m' })}` : '';
    return module.exports.GET(new NextRequest(`http://localhost/api/allconnect-compare?${params}`, {
      headers: { cookie },
    }));
  }
  assert.equal((await get()).status, 401);
  assert.equal((await get('user')).status, 403);
  assert.equal(calls.length, 0);
  for (const role of ['admin', 'manager']) {
    const response = await get(role);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.deepEqual(await response.json(), status);
  }
  assert.equal((await get('admin', 'month=2026-13')).status, 400);
  assert.deepEqual(calls, Array(2).fill(['allconnect_compare_jobs_dashboard', {
    p_status: 'with_work', p_rbm: 'R1', p_search: '', p_page: 1, p_page_size: 50, p_month: '2026-09',
  }]));
});
