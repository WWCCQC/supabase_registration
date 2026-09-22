import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { TECHNICIAN_COLUMNS, TECHNICIAN_EXCEL_HEADERS, mapTechnicianSheet, parseTechnicianWorkbook, validateTechnicianRows } from '../lib/allconnectTechniciansUpload.ts';

const row = TECHNICIAN_COLUMNS.map((column, index) => index === 1 ? '001234' : index === 23 ? '0812345678' : `ค่า ${column}`);
test('future one-header exports map every alias, preserve text and exclude header', () => {
  const [result] = mapTechnicianSheet([TECHNICIAN_EXCEL_HEADERS, row]);
  assert.deepEqual(Object.keys(result), [...TECHNICIAN_COLUMNS]);
  assert.equal(result.rbm, 'ค่า rbm');
  assert.equal(result.job_accept_type, 'ค่า job_accept_type');
  assert.equal(result.tech_id, '001234');
  assert.equal(result.tel, '0812345678');
});
test('reference double header and reordered future columns map without losing first record', () => {
  assert.equal(mapTechnicianSheet([TECHNICIAN_COLUMNS, TECHNICIAN_EXCEL_HEADERS, row]).length, 1);
  assert.deepEqual(mapTechnicianSheet([[...TECHNICIAN_EXCEL_HEADERS].reverse(), [...row].reverse()]), mapTechnicianSheet([TECHNICIAN_EXCEL_HEADERS, row]));
});
test('missing/duplicate headers, extra data and empty files fail before import', () => {
  assert.throws(() => mapTechnicianSheet([TECHNICIAN_EXCEL_HEADERS.slice(1), row]));
  assert.throws(() => mapTechnicianSheet([[...TECHNICIAN_EXCEL_HEADERS.slice(1), 'Area', 'Area'], row]));
  assert.throws(() => mapTechnicianSheet([TECHNICIAN_EXCEL_HEADERS, [...row, 'unexpected']]));
  assert.throws(() => mapTechnicianSheet([TECHNICIAN_EXCEL_HEADERS, []]));
});
test('workbook selects Tech_All, ignores Inactive and preserves Excel formatting', () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([TECHNICIAN_EXCEL_HEADERS, row]);
  sheet.B2 = { t: 'n', v: 1234, z: '000000' };
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['not a technician source']]), 'Inactive');
  XLSX.utils.book_append_sheet(workbook, sheet, 'Tech_All');
  const data = parseTechnicianWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  assert.equal(data.length, 1);
  assert.equal(data[0].tech_id, '001234');
});
test('API batch contract only permits complete text rows and bounded chunks', () => {
  const data = mapTechnicianSheet([TECHNICIAN_EXCEL_HEADERS, row]);
  assert.deepEqual(validateTechnicianRows(data), data);
  assert.throws(() => validateTechnicianRows([{ ...data[0], uuid: 'forged' }]));
  assert.throws(() => validateTechnicianRows([{ ...data[0], tech_id: 123 }]));
  assert.throws(() => validateTechnicianRows(Array(201).fill(data[0])));
});
