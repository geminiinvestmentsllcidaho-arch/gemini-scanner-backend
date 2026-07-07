import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const APPROVAL_LOCK_ROUTE = '/app/paper-broker-adapter-approval-lock';
const APPROVAL_LOCK_TITLE = 'Paper Broker Adapter Approval Lock';

const files = [
  'src/scanner/paper_app_broker_readiness_index_app_screen.mjs',
  'src/scanner/paper_app_safety_lock_status_app_screen.mjs',
  'src/scanner/paper_trade_broker_adapter_guard_app_screen.mjs',
  'src/scanner/paper_trade_operator_go_no_go_app_screen.mjs',
  'src/scanner/paper_broker_runtime_environment_preflight_app_screen.mjs'
];

test('related broker readiness route screens link the approval lock route', () => {
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes(APPROVAL_LOCK_ROUTE), `${file} missing approval lock route`);
    assert.ok(source.includes(APPROVAL_LOCK_TITLE), `${file} missing approval lock title`);
  }
});

test('fast read-only app preview links approval lock route', () => {
  const server = fs.readFileSync('src/server.js', 'utf8');
  assert.ok(server.includes(APPROVAL_LOCK_ROUTE));
  assert.ok(server.includes(APPROVAL_LOCK_TITLE));
});
