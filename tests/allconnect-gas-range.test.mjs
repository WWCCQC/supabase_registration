import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../scripts/google-apps-script/allconnect_import/Code.gs', import.meta.url), 'utf8');

function runRange(start, end, content) {
  const context = {
    ScriptApp: { getOAuthToken: () => 'test-token' },
    UrlFetchApp: { fetch: () => ({
      getResponseCode: () => 206,
      getContent: () => content,
      getHeaders: () => ({ 'Content-Range': `bytes ${start}-${end}/100` }),
      getBlob: () => ({ getBytes: () => content }),
    }) },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return Array.from(context.driveRange_('file', start, end));
}

test('Drive may strip UTF-8 BOM from the first partial response', () => {
  assert.deepEqual(runRange(0, 7, [77, 111, 110, 116, 104]), [77, 111, 110, 116, 104]);
  assert.deepEqual(runRange(3, 7, [77, 111, 110, 116, 104]), [77, 111, 110, 116, 104]);
});

test('other truncated Drive responses still fail', () => {
  assert.throws(() => runRange(10, 17, [65, 66, 67]));
});
