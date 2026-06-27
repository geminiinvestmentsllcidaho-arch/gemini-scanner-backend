import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaperBrokerAdapterApprovalLock,
  isValidPaperBrokerAdapterApprovalRecord
} from '../src/scanner/paper_broker_adapter_approval_lock.mjs';

const safeApproval = {
  type: 'paper_broker_adapter_enable_approval',
  approved: true,
  explicitApproval: true,
  approvedBy: 'Borac',
  reason: 'future paper adapter contact approval only',
  ts: '2026-06-26T00:00:00.000Z',
  safetyMode: 'paper_only',
  allowBrokerContact: true,
  allowOrderPlacement: false,
  allowLiveTrading: false,
  allowAutoTrading: false,
  allowAccountMutation: false
};

test('paper broker adapter approval lock blocks by default', () => {
  const report = buildPaperBrokerAdapterApprovalLock({
    approvalLedgerPath: '/tmp/nonexistent-paper-broker-approval-ledger.jsonl',
    now: '2026-06-26T00:00:00.000Z'
  });

  assert.equal(report.ok, true);
  assert.equal(report.version, 'paper_broker_adapter_approval_lock_v1');
  assert.equal(report.monitorOnly, true);
  assert.equal(report.diagnosticsOnly, true);
  assert.equal(report.approvalLock, true);
  assert.equal(report.lockStatus, 'locked');
  assert.equal(report.approvalLockPassed, false);
  assert.equal(report.brokerAdapterEnabled, false);
  assert.equal(report.brokerIntegrationAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.liveTradingAllowed, false);
  assert.equal(report.autoTradingAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.hasExplicitApprovalRecord, false);
  assert.ok(report.lockReasons.includes('explicit_approval_record_missing'));
});

test('approval record alone does not enable adapter unless enable is requested', () => {
  const report = buildPaperBrokerAdapterApprovalLock({
    records: [safeApproval],
    brokerAdapterEnableRequested: false,
    now: '2026-06-26T00:00:00.000Z'
  });

  assert.equal(report.hasExplicitApprovalRecord, true);
  assert.equal(report.approvalLockPassed, true);
  assert.equal(report.brokerAdapterEnabled, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
});

test('paper broker adapter can only become enabled with safe approval and explicit enable request', () => {
  const report = buildPaperBrokerAdapterApprovalLock({
    records: [safeApproval],
    brokerAdapterEnableRequested: true,
    now: '2026-06-26T00:00:00.000Z'
  });

  assert.equal(report.approvalLockPassed, true);
  assert.equal(report.validApprovalRecordCount, 1);
  assert.equal(report.brokerAdapterEnabled, true);
  assert.equal(report.brokerIntegrationAllowed, true);
  assert.equal(report.brokerContactAllowed, true);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.liveTradingAllowed, false);
  assert.equal(report.autoTradingAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test('unsafe approval records are rejected', () => {
  const report = buildPaperBrokerAdapterApprovalLock({
    records: [{ ...safeApproval, allowOrderPlacement: true }],
    brokerAdapterEnableRequested: true
  });

  assert.equal(isValidPaperBrokerAdapterApprovalRecord({ ...safeApproval, allowOrderPlacement: true }), false);
  assert.equal(report.hasExplicitApprovalRecord, false);
  assert.equal(report.approvalLockPassed, false);
  assert.equal(report.brokerAdapterEnabled, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
});
