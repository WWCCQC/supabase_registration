import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { ALLCONNECT_HEADERS, validateAllconnectHeaders } from '../lib/allconnectUpload.ts';

test('upload worker parses pipe and comma CSV with BOM, Thai, quoted delimiters and text IDs', async () => {
  const require = createRequire(import.meta.url);
  const source = ts.transpileModule(readFileSync(new URL('../components/allconnect/allconnectUpload.worker.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  for (const delimiter of ['|', ',']) {
    const row = ALLCONNECT_HEADERS.map(header => ({
      STAFF_ID: '010L1334', STAFF_NAME: 'ช่างทดสอบ', SUB_NAME: `"ศูนย์${delimiter}ทดสอบ"`,
      Job_Install: '0', Job_Repair: '1', Month: '2026-09',
    })[header] ?? '');
    const messages = [];
    const self = { postMessage(message) { messages.push(message); } };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'self', source)(require, module, module.exports, self);
    await self.onmessage({ data: { action: 'parse', file: new File([
      '\uFEFF' + ALLCONNECT_HEADERS.join(delimiter) + '\r\n' + row.join(delimiter) + '\r\n',
    ], 'techcenter.csv') } });
    const result = messages.find(message => message.type === 'chunk').results;
    assert.equal(result.errors.length, 0);
    assert.equal(validateAllconnectHeaders(result.meta.fields).ok, true);
    assert.equal(result.data[0].STAFF_ID, '010L1334');
    assert.equal(result.data[0].STAFF_NAME, 'ช่างทดสอบ');
    assert.equal(result.data[0].SUB_NAME, `ศูนย์${delimiter}ทดสอบ`);
    assert.equal(result.data[0].Job_Install, '0');
    await self.onmessage({ data: { action: 'resume' } });
    assert.ok(messages.some(message => message.type === 'complete'));
  }
});
