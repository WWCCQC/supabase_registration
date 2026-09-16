import assert from 'node:assert/strict';
import test from 'node:test';
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
