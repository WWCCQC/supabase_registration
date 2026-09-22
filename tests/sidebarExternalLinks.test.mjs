import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sidebar = readFileSync(
  new URL('../components/common/Sidebar.tsx', import.meta.url),
  'utf8',
);

test('All connect compare tech menu is visible to admins only', () => {
  const allconnectLinkStart = sidebar.indexOf('href="/allconnect-compare-tech"');
  const adminGuardStart = sidebar.lastIndexOf('{isAdmin() && (', allconnectLinkStart);
  const previousLinkEnd = sidebar.lastIndexOf('</Link>', allconnectLinkStart);
  const externalLinksStart = sidebar.indexOf('ลิงก์ภายนอก', allconnectLinkStart);
  const adminGuardEnd = sidebar.indexOf(')}', allconnectLinkStart);

  assert.ok(allconnectLinkStart >= 0, 'All connect compare tech menu is missing');
  assert.ok(adminGuardStart > previousLinkEnd, 'menu must have its own admin-only guard');
  assert.ok(adminGuardEnd > allconnectLinkStart, 'admin-only guard must close after the menu');
  assert.ok(adminGuardEnd < externalLinksStart, 'admin-only guard must not change external-link permissions');
});

test('Equipment Inspection is a secure external link in the external links section', () => {
  const externalLinksStart = sidebar.indexOf('ลิงก์ภายนอก');
  const equipmentLinkStart = sidebar.indexOf(
    'href="https://script.google.com/macros/s/AKfycbyq-8jdXTjN7LiIRRGlOerUa3LdmCrQtJvNvIIcq9WfRltqnHSrwMK2QaG5kohjO5DrWQ/exec"',
  );
  const manualLinkStart = sidebar.indexOf('href="/manual"');

  assert.ok(externalLinksStart >= 0, 'external links section is missing');
  assert.ok(equipmentLinkStart > externalLinksStart, 'Equipment Inspection must be under external links');
  assert.ok(manualLinkStart > equipmentLinkStart, 'Equipment Inspection must appear before the manual');

  const equipmentLink = sidebar.slice(equipmentLinkStart, manualLinkStart);
  assert.match(equipmentLink, /target="_blank"/);
  assert.match(equipmentLink, /rel="noopener noreferrer"/);
  assert.match(equipmentLink, /title="Equipment Inspection"/);
  assert.match(equipmentLink, />\s*Equipment Inspection\s*<ExternalIcon \/>/);
});
