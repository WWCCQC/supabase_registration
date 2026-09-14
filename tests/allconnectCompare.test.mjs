import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCompareParams } from '../lib/allconnectCompare.ts';

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
