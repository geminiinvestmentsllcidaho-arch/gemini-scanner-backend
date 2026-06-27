import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('paper trade local lifecycle e2e validates blocked and complete paths safely', () => {
  const raw = execFileSync('node', ['scripts/validate_paper_trade_local_lifecycle_e2e.mjs'], {
    encoding: 'utf8'
  });

  const result = JSON.parse(raw);

  assert.equal(result.ok, true);
  assert.equal(result.version, 'paper_trade_local_lifecycle_e2e_validation_v1');
  assert.equal(result.monitorOnly, true);
  assert.equal(result.paperOnly, true);

  assert.equal(result.blocked.status, 'blocked_or_partial');
  assert.equal(result.blocked.lifecycleComplete, false);
  assert.equal(result.blocked.wroteAnyRecord, false);
  assert.equal(result.blocked.auditRecords, 1);
  assert.equal(result.blocked.intentRecords, 0);
  assert.equal(result.blocked.ticketRecords, 0);
  assert.equal(result.blocked.fillRecords, 0);
  assert.equal(result.blocked.positionRecords, 0);

  assert.equal(result.complete.status, 'complete_local_simulation');
  assert.equal(result.complete.lifecycleComplete, true);
  assert.equal(result.complete.wroteAnyRecord, true);
  assert.equal(result.complete.auditRecords, 1);
  assert.equal(result.complete.intentRecords, 1);
  assert.equal(result.complete.ticketRecords, 1);
  assert.equal(result.complete.fillRecords, 1);
  assert.equal(result.complete.positionRecords, 1);
  assert.equal(result.complete.openPositionCount, 1);
  assert.equal(result.complete.totalCostBasis, 1010);
  assert.equal(result.complete.totalRealizedPnl, 0);

  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
  assert.equal(result.safety.localJsonlOnly, true);
});
