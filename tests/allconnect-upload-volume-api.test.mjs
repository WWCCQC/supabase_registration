import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const harness = new URL('./allconnect-upload-volume-api.mjs', import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'allconnect-harness-'));
const envPath = join(directory, '.env');
writeFileSync(envPath, 'NEXT_PUBLIC_SUPABASE_URL=https://sggunyytungtyhezchft.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=test-only\n');
after(() => rmSync(directory, { recursive: true, force: true }));

function invoke(mode, batch) {
  const fixture = {
    batch, count: 26780, fingerprint: '62a9cc3b49237acb366eb4af8f1c201b',
    snapshot: '2026-09-14T07:34:36.765894Z',
  };
  const args = [process.execPath, fileURLToPath(harness), mode,
    ...(mode === 'run' ? [envPath, JSON.stringify(fixture)] : [batch])];
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.fetch = async (url) => { throw new Error('NETWORK_ATTEMPT ' + new URL(url).pathname); };
    process.argv = ${JSON.stringify(args)};
    await import(${JSON.stringify(harness.href)});
  `], { encoding: 'utf8' });
}

for (const batch of [
  'aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}',
  'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
  '------------------------------------',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa ',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\n',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\r\n',
]) {
  test(`non-canonical UUID rejected before any API request: ${batch}`, () => {
    const result = invoke('run', batch);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AssertionError/);
    assert.doesNotMatch(result.stderr, /NETWORK_ATTEMPT/);
  });
}

test('canonical UUID reaches only the unconditional rollback probe endpoint', () => {
  const result = invoke('run', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NETWORK_ATTEMPT \/rest\/v1\/rpc\/test_allconnect_upload_volume_probe/);
  assert.doesNotMatch(result.stderr, /rpc\/replace_allconnect_import/);
});

test('batch cleanup rejects non-canonical UUID without emitting SQL', () => {
  const result = invoke('cleanup-batch', 'aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaaaaaa');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AssertionError/);
  assert.equal(result.stdout, '');
});
