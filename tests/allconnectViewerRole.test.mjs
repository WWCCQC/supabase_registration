import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server.js';

const require = createRequire(import.meta.url);
const secret = 'viewer-route-test-secret';
const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = secret;

const source = ts.transpileModule(readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', source)(name => {
  if (name === 'next/server') return { NextResponse };
  if (name === 'jose') return { jwtVerify };
  return require(name);
}, module, module.exports);

test('allconnect viewer is confined to the report and auth endpoints', async t => {
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  async function visit(role, pathname) {
    const token = role ? await new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m').sign(new TextEncoder().encode(secret)) : null;
    const request = new NextRequest(`http://localhost${pathname}`, {
      headers: token ? { cookie: `auth-token=${token}` } : {},
    });
    return module.exports.middleware(request);
  }

  for (const pathname of ['/', '/dashboard', '/admin-directory', '/manual']) {
    const response = await visit('allconnect_viewer', pathname);
    assert.equal(response.headers.get('location'), 'http://localhost/allconnect-compare-tech', pathname);
  }
  for (const pathname of ['/api/technicians', '/api/technicians/example.json', '/api/allconnect-upload', '/api/allconnect-technicians-upload']) {
    const response = await visit('allconnect_viewer', pathname);
    assert.equal(response.status, 403, pathname);
  }
  for (const pathname of ['/allconnect-compare-tech', '/api/allconnect-compare', '/api/auth/me', '/api/auth/logout']) {
    const response = await visit('allconnect_viewer', pathname);
    assert.equal(response.headers.get('x-middleware-next'), '1', pathname);
  }
  assert.equal((await visit('admin', '/')).headers.get('x-middleware-next'), '1');
  assert.equal((await visit('manager', '/dashboard')).headers.get('x-middleware-next'), '1');
  assert.match((await visit(null, '/allconnect-compare-tech')).headers.get('location') ?? '', /\/login\?/);
  assert.match(module.exports.config.matcher.join(' '), /\(\?!_next/);
});
