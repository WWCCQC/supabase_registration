import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { contractColumns, filterContracts, groupContracts, groupStatusCards, onProcessRows } from '../lib/contractDashboard.ts';

test('table and Excel columns use the current contract_c schema', () => {
  const keys = contractColumns.map(([key]) => key);
  for (const key of ['corporate_registration_no', 'start_contract', 'end_contract', 'contract_guarantee_amount', 'group_status']) assert.ok(keys.includes(key));
  for (const key of ['company_registration_no', 'contract_start_date', 'contract_end_date', 'total_contract_guarantee_amount', 'uuid', 'create_at', 'update_at']) assert.ok(!keys.includes(key));
  const route = readFileSync(new URL('../app/api/contract-c/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\.order\('corporate_registration_no'\)/);
  assert.match(route, /payload\.role !== 'admin'/);
});

test('new columns are searchable and group status filters preserve contract status summaries', () => {
  const rows = [
    { corporate_registration_no: '001', start_contract: '2026-10-01', contract_guarantee_amount: '50000', group_status: 'Complete', contract_status: 'สัญญา Active' },
    { corporate_registration_no: '002', group_status: 'On Process', contract_status: 'สัญญา Active' },
    { corporate_registration_no: '003', group_status: 'Cancel', contract_status: 'ยกเลิกสัญญา' },
  ];
  for (const query of ['001', '2026-10-01', '50000']) assert.deepEqual(filterContracts(rows, query, {}), [rows[0]]);
  assert.deepEqual(filterContracts(rows, '', { group_status: 'Complete' }), [rows[0]]);
  assert.deepEqual(groupContracts(rows, 'contract_status'), [['สัญญา Active', 2], ['ยกเลิกสัญญา', 1]]);
});

test('summary cards count from group_status and keep the overall total', () => {
  const rows = [
    { corporate_registration_no: '001', group_status: 'Complete' },
    { corporate_registration_no: '002', group_status: 'Complete' },
    { corporate_registration_no: '003', group_status: 'Cancel' },
    { corporate_registration_no: '004', group_status: 'Complete' },
    { corporate_registration_no: '005', group_status: null },
    { corporate_registration_no: '006', group_status: ' ' },
  ];
  const cards = groupContracts(rows, 'group_status');
  assert.deepEqual(cards, [['Complete', 3], ['ไม่ระบุ', 2], ['Cancel', 1]]);
  assert.equal(cards.reduce((sum, [, count]) => sum + count, 0), rows.length);
  const component = readFileSync(new URL('../components/ContractDashboard.tsx', import.meta.url), 'utf8');
  assert.match(component, /groupStatusCards\(cardRows\)/);
  assert.match(component, /changeFilter\('group_status'/);
});

test('group status cards follow Complete, On Process, Cancel order', () => {
  const rows = [
    { group_status: 'Cancel' }, { group_status: 'Cancel' }, { group_status: 'Cancel' },
    { group_status: 'On Process' }, { group_status: 'On Process' },
    { group_status: 'Complete' },
  ];
  assert.deepEqual(groupStatusCards(rows), [['Complete', 1], ['On Process', 2], ['Cancel', 3]]);
  // case/spacing differences still match; missing groups show 0; other values go last
  assert.deepEqual(groupStatusCards([{ group_status: 'on  process' }, { group_status: 'Other' }]),
    [['Complete', 0], ['on  process', 1], ['Cancel', 0], ['Other', 1]]);
});

test('contract status chart uses only On Process rows grouped by installation_status', () => {
  const rows = [
    { group_status: 'On Process', installation_status: 'รอเอกสาร' },
    { group_status: 'On Process', installation_status: 'รอเอกสาร' },
    { group_status: 'on process ', installation_status: 'รอ BG' },
    { group_status: 'Complete', installation_status: 'รอเอกสาร' },
    { group_status: 'Cancel', installation_status: 'ยกเลิก' },
  ];
  const onProcess = onProcessRows(rows);
  assert.equal(onProcess.length, 3);
  assert.deepEqual(groupContracts(onProcess, 'installation_status'), [['รอเอกสาร', 2], ['รอ BG', 1]]);
  const component = readFileSync(new URL('../components/ContractDashboard.tsx', import.meta.url), 'utf8');
  assert.match(component, /groupContracts\(reasonRows, 'installation_status'\)/);
  assert.match(component, /รายละเอียดสถานะสัญญา · \{number\(reasonRows\.length\)\}/);
});
