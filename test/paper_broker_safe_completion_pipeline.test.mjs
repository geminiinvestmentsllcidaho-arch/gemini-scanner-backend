import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  appendPaperBrokerAdapterApprovalRecord,
  evaluatePaperBrokerAdapterApproval
} from '../src/scanner/paper_broker_adapter_approval_record_tool.mjs';

import {
  buildAlpacaPaperOrderPayload,
  previewAlpacaPaperBrokerOrder
} from '../src/scanner/alpaca_paper_broker_adapter.mjs';

import {
  buildPaperOrderSubmitDryRunPreview
} from '../src/scanner/paper_order_submit_dry_run_preview.mjs';

import {
  getPaperTradingMonitoringDiagnostics,
  setPaperTradingKillSwitchState,
  appendPaperOrderMonitoringEvent
} from '../src/scanner/paper_trading_monitoring_kill_switch.mjs';

import {
  getFirstRealPaperOrderTestGateDiagnostics
} from '../src/scanner/first_real_paper_order_test_gate.mjs';

import {
  getPaperTradingFinalGoNoGoDiagnostics
} from '../src/scanner/paper_trading_final_go_no_go.mjs';

import {
  getRealTradingConversionLockDiagnostics
} from '../src/scanner/real_trading_conversion_lock.mjs';

function tempFile(name) {
  return path.join(os.tmpdir(), `gemini-scanner-${process.pid}-${Date.now()}-${name}`);
}

test('broker adapter approval record is required and never approves order placement', async () => {
  const approvalRecordPath = tempFile('approval.jsonl');

  const blocked = await evaluatePaperBrokerAdapterApproval({
    approvalRecordPath,
    nowMs: 1700000000000,
    env: {}
  });

  assert.equal(blocked.approvalLockPassed, false);
  assert.equal(blocked.brokerContactAllowed, false);
  assert.equal(blocked.orderPlacementAllowed, false);
  assert.ok(blocked.lockReasons.includes('explicit_approval_record_missing'));
  assert.ok(blocked.lockReasons.includes('broker_adapter_env_disabled'));

  const record = await appendPaperBrokerAdapterApprovalRecord({
    by: 'Borac',
    reason: 'test approval record only',
    adapter: 'alpaca-paper'
  }, { approvalRecordPath, nowMs: 1700000000000 });

  assert.equal(record.ok, true);

  const unlockedContactOnly = await evaluatePaperBrokerAdapterApproval({
    approvalRecordPath,
    nowMs: 1700000001000,
    env: {
      PAPER_BROKER_ADAPTER_REQUESTED: '1',
      PAPER_BROKER_ADAPTER_ENABLED: '1'
    }
  });

  assert.equal(unlockedContactOnly.approvalLockPassed, true);
  assert.equal(unlockedContactOnly.brokerContactAllowed, true);
  assert.equal(unlockedContactOnly.orderPlacementAllowed, false);

  await fs.rm(approvalRecordPath, { force: true });
});

test('alpaca paper adapter builds payload but preview never contacts broker', async () => {
  const payload = buildAlpacaPaperOrderPayload({
    symbol: 'aapl',
    side: 'buy',
    qty: 1,
    orderType: 'market',
    timeInForce: 'day'
  }, { nowMs: 1700000000000 });

  assert.deepEqual(payload, {
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    qty: '1'
  });

  const preview = await previewAlpacaPaperBrokerOrder({
    symbol: 'AAPL',
    side: 'buy',
    qty: 1
  }, {
    approvalRecordPath: tempFile('missing-approval.jsonl'),
    nowMs: 1700000000000,
    env: {}
  });

  assert.equal(preview.version, 'alpaca_paper_broker_adapter_v1');
  assert.equal(preview.preview.blocked, true);
  assert.equal(preview.preview.wouldContactBroker, false);
  assert.equal(preview.preview.wouldPlaceOrder, false);
  assert.equal(preview.orderPlacementAllowed, false);
  assert.ok(preview.preview.blockReasons.includes('broker_contact_not_performed'));
});

test('paper order submit dry-run validates payload without submit attempt', async () => {
  const dryRun = await buildPaperOrderSubmitDryRunPreview({
    symbol: 'MSFT',
    side: 'sell',
    qty: 2,
    orderType: 'market',
    timeInForce: 'day',
    marketSession: 'regular'
  }, {
    approvalRecordPath: tempFile('missing-approval.jsonl'),
    nowMs: 1700000000000,
    env: {}
  });

  assert.equal(dryRun.version, 'paper_order_submit_dry_run_preview_v1');
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.submitAttempted, false);
  assert.equal(dryRun.brokerContactAttempted, false);
  assert.equal(dryRun.preview.blocked, true);
  assert.equal(dryRun.preview.wouldContactBroker, false);
  assert.equal(dryRun.preview.wouldPlaceOrder, false);
  assert.deepEqual(dryRun.alpacaPayloadPreview, {
    symbol: 'MSFT',
    side: 'sell',
    type: 'market',
    time_in_force: 'day',
    qty: '2'
  });
});

test('paper trading monitoring kill switch defaults safe and tracks events', async () => {
  const killSwitchPath = tempFile('kill.json');
  const monitoringLedgerPath = tempFile('monitor.jsonl');

  const initial = await getPaperTradingMonitoringDiagnostics({ killSwitchPath, monitoringLedgerPath });
  assert.equal(initial.killSwitchActive, true);
  assert.equal(initial.paperTradingDisabled, true);
  assert.equal(initial.trackedOrderCount, 0);

  await setPaperTradingKillSwitchState({
    killSwitchActive: true,
    paperTradingDisabled: true,
    reason: 'test disable'
  }, { killSwitchPath, nowMs: 1700000000000 });

  await appendPaperOrderMonitoringEvent({
    eventType: 'preview',
    orderId: 'dry-run-1',
    status: 'blocked',
    symbol: 'AAPL'
  }, { monitoringLedgerPath, nowMs: 1700000000000 });

  const after = await getPaperTradingMonitoringDiagnostics({ killSwitchPath, monitoringLedgerPath });
  assert.equal(after.killSwitchActive, true);
  assert.equal(after.trackedOrderCount, 1);
  assert.equal(after.latestOrderEvent.orderId, 'dry-run-1');

  await fs.rm(killSwitchPath, { force: true });
  await fs.rm(monitoringLedgerPath, { force: true });
});

test('first real paper order test gate remains blocked', async () => {
  const gate = await getFirstRealPaperOrderTestGateDiagnostics({
    approvalRecordPath: tempFile('missing-approval.jsonl'),
    killSwitchPath: tempFile('missing-kill.json'),
    monitoringLedgerPath: tempFile('missing-monitor.jsonl'),
    nowMs: 1700000000000,
    env: {}
  });

  assert.equal(gate.version, 'first_real_paper_order_test_gate_v1');
  assert.equal(gate.firstPaperOrderAllowed, false);
  assert.equal(gate.submitAttempted, false);
  assert.equal(gate.brokerContactAttempted, false);
  assert.equal(gate.blocked, true);
  assert.ok(gate.blockReasons.includes('first_real_paper_order_not_batch_executed'));
  assert.ok(gate.blockReasons.includes('manual_operator_confirmation_required'));
});

test('operator final go/no-go dashboard shows module complete but no-go', async () => {
  const status = await getPaperTradingFinalGoNoGoDiagnostics({
    approvalRecordPath: tempFile('missing-approval.jsonl'),
    killSwitchPath: tempFile('missing-kill.json'),
    monitoringLedgerPath: tempFile('missing-monitor.jsonl'),
    nowMs: 1700000000000,
    env: {}
  });

  assert.equal(status.version, 'paper_trading_final_go_no_go_v1');
  assert.equal(status.moduleComplete, true);
  assert.equal(status.goNoGo, 'NO_GO');
  assert.equal(status.finalStatus, 'blocked');
  assert.equal(status.blocked, true);
  assert.equal(status.orderPlacementAllowed, false);
  assert.equal(status.liveTradingAllowed, false);
  assert.equal(status.autoTradingAllowed, false);
  assert.equal(status.stages.alpacaPaperAdapter, 'complete_locked');
});

test('real trading conversion layer is separately locked', () => {
  const lock = getRealTradingConversionLockDiagnostics({ nowMs: 1700000000000 });

  assert.equal(lock.version, 'real_trading_conversion_lock_v1');
  assert.equal(lock.paperModuleTransferable, true);
  assert.equal(lock.realTradingApprovalPassed, false);
  assert.equal(lock.realTradingAllowed, false);
  assert.equal(lock.orderPlacementAllowed, false);
  assert.equal(lock.blocked, true);
  assert.ok(lock.blockReasons.includes('separate_real_trading_approval_lock_required'));
});
