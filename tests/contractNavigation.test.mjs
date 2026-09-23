import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sidebar = fs.readFileSync(new URL('../components/common/Sidebar.tsx', import.meta.url), 'utf8');
const contractPagePath = new URL('../app/contract/page.tsx', import.meta.url);

test('Contract appears in the main sidebar menu and links to its page', () => {
  const mainMenuStart = sidebar.indexOf('เมนูหลัก');
  const managedMenuStart = sidebar.indexOf('จัดการข้อมูล');
  const contractLinkStart = sidebar.indexOf('href="/contract"');

  assert.ok(contractLinkStart >= 0, 'Contract menu is missing');
  assert.ok(contractLinkStart > mainMenuStart, 'Contract must be in the main menu');
  assert.ok(contractLinkStart < managedMenuStart, 'Contract must appear before the managed-data section');
  assert.match(sidebar.slice(contractLinkStart, managedMenuStart), />Contract</);
  const adminGuardStart = sidebar.lastIndexOf('{isAdmin() && (', contractLinkStart);
  const previousLinkEnd = sidebar.lastIndexOf('</Link>', contractLinkStart);
  const adminGuardEnd = sidebar.indexOf(')}', contractLinkStart);
  assert.ok(adminGuardStart > previousLinkEnd, 'Contract menu must have an admin-only guard');
  assert.ok(adminGuardEnd > contractLinkStart && adminGuardEnd < managedMenuStart);
});

test('Contract page provides the three requested tabs with Track C selected first', () => {
  assert.ok(fs.existsSync(contractPagePath), 'Contract page is missing');

  const page = fs.readFileSync(contractPagePath, 'utf8');

  assert.match(page, /\['Track C', 'Solar', 'Corporate'\]/);
  assert.match(page, /useState<ContractTab>\('Track C'\)/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tab"/);
  assert.match(page, /aria-selected=/);
  assert.match(page, /<ProtectedRoute requiredRole="admin">/);
});
