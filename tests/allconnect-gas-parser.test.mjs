import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../scripts/google-apps-script/allconnect_import/Code.gs', import.meta.url), 'utf8');

test('CSV parser decodes each byte range once and preserves split Thai characters', () => {
  let decodes = 0;
  const context = { Utilities: { newBlob: bytes => {
    decodes++;
    return { getDataAsString: () => Buffer.from(bytes).toString('utf8') };
  } } };
  vm.createContext(context);
  vm.runInContext(code, context);
  const csv = 'a|b|c\r\n"ทด|สอบ"|"x""y"|z\r\nlast|row|✓';
  const bytes = Buffer.from(csv);
  const parser = { mode: 0, field: '', row: [], skipLF: false, utf8Carry: [] };
  const rows = [];
  for (let i = 0; i < bytes.length; i += 3) {
    context.parseBytes_(parser, [...bytes.subarray(i, i + 3)], row => rows.push([...row]));
  }
  context.finishParser_(parser, row => rows.push([...row]));
  assert.deepEqual(rows, [['a', 'b', 'c'], ['ทด|สอบ', 'x"y', 'z'], ['last', 'row', '✓']]);
  const before = decodes;
  const bulk = Buffer.from(Array.from({ length: 100 }, () => '2026-10|07/10/2026|กรุงเทพ\n').join(''));
  const bulkParser = { mode: 0, field: '', row: [], skipLF: false, utf8Carry: [] };
  context.parseBytes_(bulkParser, [...bulk], () => {});
  context.finishParser_(bulkParser, () => {});
  assert.ok(decodes - before <= 2, `too many UTF-8 decodes for one range: ${decodes - before}`);
});
