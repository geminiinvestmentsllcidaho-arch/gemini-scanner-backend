import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');

test('customer authentication routes exist', () => {
  assert.match(source, /app\.get\('\/login'/);
  assert.match(source, /app\.post\('\/login'/);
  assert.match(source, /app\.post\('\/logout'/);
});

test('customer routes require signed customer sessions', () => {
  for (const route of [
    '/customer',
    '/customer/scanner',
    '/customer/watchlist',
    '/customer/settings',
    '/customer/scanner/under-five/:symbol',
    '/customer/scanner/under-five',
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`app\\.get\\('${escaped}', requireCustomerSession,`));
  }
});

test('verification and duplicate signup send customers to login', () => {
  assert.match(source, /href="\/login">Continue to sign in/);
  assert.match(source, /href="\/login">Sign in/);
});

test('settings page exposes logout form', () => {
  assert.match(source, /form method="post" action="\/logout"/);
  assert.match(source, />Log out<\/button>/);
});
