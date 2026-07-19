import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const theme = fs.readFileSync(new URL('../src/scanner/global_theme.mjs', import.meta.url), 'utf8');
test('global theme bootstrap is CSP-safe and externally loaded', () => {
  assert.match(theme, /<script src="\/assets\/global-theme\.js"><\/script>/);
  assert.doesNotMatch(theme, /localStorage\.getItem\("gs\.theme"\)/);
  assert.match(server, /app\.get\('\/assets\/global-theme\.js'/);
});
test('settings appearance previews immediately and persists locally', () => {
  assert.match(server, /form\[action="\/customer\/settings\/display"\]/);
  assert.match(server, /themeControl\?\.addEventListener\('change', preview\)/);
  assert.match(server, /densityControl\?\.addEventListener\('change', preview\)/);
  assert.match(server, /reducedControl\?\.addEventListener\('change', preview\)/);
  assert.match(server, /localStorage\.setItem\('gs\.theme'/);
});
test('display save refreshes signed customer session', () => {
  assert.match(server, /createCustomerSessionToken\(result\.account, \{ secret: CUSTOMER_SESSION_SECRET \}\)/);
  assert.match(server, /res\.cookie\(CUSTOMER_COOKIE_NAME, refreshedToken, buildCustomerSessionCookieOptions\(\)\)/);
});
