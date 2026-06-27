import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaperBrokerAdapterApprovalLockPanel } from '../src/scanner/paper_broker_adapter_approval_lock_panel.mjs';

test('paper broker adapter approval lock panel summarizes blocked state safely', () => {
  const panel = buildPaperBrokerAdapterApprovalLockPanel({
    approvalLedgerPath: '/tmp/nonexistent-paper-broker-panel-ledger.jsonl',
    now: '2026-06-26T00:00:00.000Z'
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_broker_adapter_approval_lock_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.status, 'locked');
  assert.equal(panel.brokerAdapterEnabled, false);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.orderPlacementAllowed, false);
  assert.equal(panel.liveTradingAllowed, false);
  assert.equal(panel.autoTradingAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);
  assert.equal(panel.blocked, true);
  assert.ok(panel.lockReasons.includes('explicit_approval_record_missing'));
});
