import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContractPortfolio, contractOverview, portfolioCounts } from '../lib/contractSummary.ts';

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

test('overview deduplicates agents across sources and gives active contracts precedence', () => {
  const companies = buildContractPortfolio({
    'track-c': [
      { corporate_registration_no: '0123456789012', group_status: 'Cancel' },
      { corporate_registration_no: '1111111111111', group_status: 'Complete' },
      { corporate_registration_no: '2222222222222', group_status: 'Cancel' },
      { corporate_registration_no: null, group_status: 'Complete' },
    ],
    solar: [
      { corporate_registration_no: '0-123456789012', group_status: ' ON   Process ' },
      { corporate_registration_no: '1111111111111', group_status: 'complete' },
    ],
    corporate: [{ corporate_registration_no: '1111111111111', group_status: 'Cancel' }],
  });
  const result = contractOverview(companies);
  assert.deepEqual(result.agents, { total: 3, active: 2, inactive: 1, missingRegistration: 1 });
  assert.deepEqual(result.totals, { total: 7, active: 4, complete: 3, onProcess: 1, cancelled: 3, other: 0 });
  assert.deepEqual(result.bySource.solar, { total: 2, active: 2, complete: 1, onProcess: 1, cancelled: 0, other: 0 });
  assert.equal(result.agents.total, result.agents.active + result.agents.inactive);
});

test('unknown contract statuses remain visible and empty data returns zeros', () => {
  const result = contractOverview(buildContractPortfolio({
    'track-c': [{ corporate_registration_no: '1111111111111', group_status: 'Pending review' }],
    solar: [{ corporate_registration_no: '1111111111111', group_status: null }], corporate: [],
  }));
  assert.equal(result.totals.other, 2);
  assert.equal(result.totals.cancelled, 0);
  assert.equal(result.agents.inactive, 1);
  const empty = contractOverview([]);
  assert.equal(empty.agents.total, 0);
  assert.equal(empty.totals.total, 0);
  assert.equal(empty.bySource.corporate.total, 0);
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
