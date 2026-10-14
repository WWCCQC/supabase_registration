import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContractPortfolio, portfolioCounts } from '../lib/contractSummary.ts';

test('joins three contract types by registration and counts companies rather than rows', () => {
  const datasets = {
    'track-c': [
      { uuid: 'a', corporate_registration_no: '0123456789012', partner_name: 'Alpha' },
      { uuid: 'b', corporate_registration_no: '0123456789012', partner_name: 'Alpha' },
      { uuid: 'c', corporate_registration_no: '5555555555555', partner_name: 'Beta' },
    ],
    solar: [{ uuid: 'd', corporate_registration_no: '0-123456789012', partner_name: 'Alpha Solar' }],
    corporate: [{ uuid: 'e', corporate_registration_no: '0123456789012', partner_name: 'Alpha Corp' }],
  };
  const companies = buildContractPortfolio(datasets);
  assert.equal(companies.length, 2);
  assert.equal(companies[0].registration, '0123456789012');
  assert.deepEqual(companies[0].sources, ['track-c', 'solar', 'corporate']);
  assert.equal(companies[0].contracts.length, 4);
  assert.deepEqual(portfolioCounts(companies), { companies: 2, missingRegistration: 0, contracts: 5, byTypeCount: [1, 0, 1] });
});

test('does not merge contracts with missing registrations', () => {
  const companies = buildContractPortfolio({
    'track-c': [{ uuid: 'a', partner_name: 'Same' }, { uuid: 'b', corporate_registration_no: '', partner_name: 'Same' }],
    solar: [{ uuid: 'c', corporate_registration_no: ' ', partner_name: 'Same' }],
    corporate: [],
  });
  assert.equal(companies.length, 3);
  assert.equal(portfolioCounts(companies).missingRegistration, 3);
  assert.equal(portfolioCounts(companies).companies, 0);
});
