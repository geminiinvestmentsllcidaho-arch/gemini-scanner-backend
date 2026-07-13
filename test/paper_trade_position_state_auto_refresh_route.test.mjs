import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('server exposes paper position state auto refresh diagnostics route safely', () => {
  const server = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const match = server.match(/app\.get\('\/diagnostics\/paper-trade-position-state-auto-refresh',[\s\S]*?\n\}\);/);

  assert.ok(match);
  assert.match(match[0], /paperPositionStateAutoRefresh\.diagnostics\(\)/);
  assert.doesNotMatch(match[0], /post|put|patch|delete|orderPlacement|brokerContact/i);
});
