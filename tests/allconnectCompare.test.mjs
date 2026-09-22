import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calculateWithoutWorkCoverage, calculateWorkingDays, formatRegionBarLabel, parseCompareParams } from '../lib/allconnectCompare.ts';

test('without-work coverage uses only technicians with a comparison result', () => {
  assert.equal(calculateWithoutWorkCoverage(854, 91), 9.6);
  assert.equal(calculateWithoutWorkCoverage(0, 4), 100);
  assert.equal(calculateWithoutWorkCoverage(0, 0), null);
});

test('working days subtract a valid register date from the current calendar date', () => {
  const today = new Date(2026, 8, 15, 12, 0, 0);
  assert.equal(calculateWorkingDays('2026-09-01', today), 14);
  assert.equal(calculateWorkingDays('2026-09-15', today), 0);
  assert.equal(calculateWorkingDays('2024-02-29', new Date(2024, 2, 1, 12, 0, 0)), 1);
  assert.equal(calculateWorkingDays('27/02/2024', new Date(2024, 2, 1, 12, 0, 0)), 3);
});

test('dashboard comparison reads only Installation leaders from allconnect_technicians', () => {
  const sql = readFileSync(new URL('../create-allconnect-compare-dashboard.sql', import.meta.url), 'utf8');
  assert.match(sql, /FROM public\.allconnect_technicians t/);
  assert.match(sql, /btrim\(t\.type_of_work\) = 'Installation'/);
  assert.match(sql, /btrim\(t\.workgroup_status\) = 'หัวหน้า'/);
  assert.doesNotMatch(sql, /FROM public\.technicians t/);
  for (const obsolete of ['provider_group_type', "job_accept_type) IN", "t.provider) IN"]) {
    assert.equal(sql.includes(obsolete), false, `obsolete technician filter remains: ${obsolete}`);
  }
  for (const mapping of ['t.tech_name', 't.tech_surename', 't.register_date', 't.rbm', 't.cbm', 't.company_type', 't.depot_code', 't.depot_name']) {
    assert.equal(sql.includes(mapping), true, `missing source mapping: ${mapping}`);
  }
});

test('working days are blank when the register date cannot be subtracted', () => {
  const today = new Date(2026, 8, 15, 12, 0, 0);
  for (const value of ['', 'not-a-date', '2026-02-30', '2026-09-16']) {
    assert.equal(calculateWorkingDays(value, today), null);
  }
});

test('region bar labels show technician count and share of the RBM total', () => {
  assert.equal(formatRegionBarLabel(127, 408), '127 (31.1%)');
  assert.equal(formatRegionBarLabel(281, 408), '281 (68.9%)');
  assert.equal(formatRegionBarLabel(0, 408), '0 (0.0%)');
  assert.equal(formatRegionBarLabel(0, 0), '0 (-)');
});

test('comparison defaults to the first page of technicians without work', () => {
  assert.deepEqual(parseCompareParams(new URLSearchParams()), {
    p_rbm: null, p_status: 'without_work', p_search: '', p_page: 1, p_page_size: 50,
  });
});

test('filters preserve leading zeroes, text IDs and literal search punctuation', () => {
  const result = parseCompareParams(new URLSearchParams({ rbm: ' R1_BMA-West ', q: ' 001%_ABC ', status: 'with_work', page: '2', pageSize: '500' }));
  assert.equal(result.p_rbm, 'R1_BMA-West');
  assert.equal(result.p_search, '001%_ABC');
  assert.equal(result.p_status, 'with_work');
  assert.equal(result.p_page, 2);
  assert.equal(result.p_page_size, 500);
});

test('invalid or unbounded pagination, status and filters are rejected', () => {
  for (const values of [
    { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: 'NaN' }, { page: '1000001' },
    { pageSize: '501' }, { pageSize: '0' }, { pageSize: '' }, { status: 'anything' },
    { q: 'x'.repeat(201) }, { rbm: 'x'.repeat(201) },
  ]) assert.throws(() => parseCompareParams(new URLSearchParams(values)));
});
