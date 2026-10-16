import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../components/common/Sidebar.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
let role = 'allconnect_viewer';
const module = { exports: {} };
new Function('require', 'module', 'exports', source)(name => {
  if (name === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };
  if (name === 'next/navigation') return { usePathname: () => '/allconnect-compare-tech' };
  if (name === '@/lib/useAuth') return { useAuth: () => ({
    user: { role }, isAdmin: () => role === 'admin', isManager: () => role === 'manager',
  }) };
  return require(name);
}, module, module.exports);

test('viewer sidebar contains only All connect compare tech, while admin menu remains available', () => {
  const Sidebar = module.exports.default;
  const links = () => [...renderToStaticMarkup(React.createElement(Sidebar, { collapsed: false, onToggle() {} }))
    .matchAll(/href="([^"]+)"/g)].map(match => match[1]);

  role = 'allconnect_viewer';
  assert.deepEqual(links(), ['/allconnect-compare-tech']);
  role = 'admin';
  assert.ok(links().includes('/allconnect-compare-tech'));
  assert.ok(links().includes('/'));
  role = 'manager';
  assert.ok(links().includes('/blacklist'));
});
