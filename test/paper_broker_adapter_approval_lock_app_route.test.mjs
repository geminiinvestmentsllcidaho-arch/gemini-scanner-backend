import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function routeBlock(server) {
  const start = server.indexOf("app.get('/app/paper-broker-adapter-approval-lock'");
  assert.notEqual(start, -1);
  const end = server.indexOf("\napp.get(", start + 1);
  return end === -1 ? server.slice(start) : server.slice(start, end);
}

test('paper broker adapter approval lock app route is registered and read-only', () => {
  const server = fs.readFileSync('src/server.js', 'utf8');
  const block = routeBlock(server);
  assert.ok(block.includes('brokerContactAllowed='));
  assert.ok(block.includes('orderPlacementAllowed='));
  assert.ok(block.includes('accountMutationAllowed='));
  assert.doesNotMatch(block, /<form/i);
  assert.doesNotMatch(block, /type=['"]submit['"]/i);
});

test('app navigation lists paper broker adapter approval lock', () => {
  const nav = fs.readFileSync('src/scanner/app_navigation_readonly.mjs', 'utf8');
  assert.ok(nav.includes('id: "paper_broker_adapter_approval_lock"'));
  assert.ok(nav.includes('Paper Broker Adapter Approval Lock'));
  assert.ok(nav.includes('href: "/app/paper-broker-adapter-approval-lock"'));
  assert.ok(nav.includes('PAPER_BROKER_ADAPTER_APPROVAL_LOCK_READONLY'));
});
