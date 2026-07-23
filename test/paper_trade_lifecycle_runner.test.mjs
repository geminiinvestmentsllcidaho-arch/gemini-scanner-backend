import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PAPER_TRADE_LIFECYCLE_RUNNER_VERSION,
  previewPaperTradeLifecycleRun,
  readPaperTradeLifecycleRunnerPanel,
  runPaperTradeLifecycle
} from '../src/scanner/paper_trade_lifecycle_runner.mjs';

function tmpLedger(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), name)), 'ledger.jsonl');
}

function paths() {
  return {
    intentLedgerPath: tmpLedger('paper-lifecycle-runner-intent-'),
    ticketLedgerPath: tmpLedger('paper-lifecycle-runner-ticket-'),
    fillLedgerPath: tmpLedger('paper-lifecycle-runner-fill-'),
    positionLedgerPath: tmpLedger('paper-lifecycle-runner-position-')
  };
}

test('paper lifecycle runner preview never writes local ledgers', () => {
  const p = paths();

  const preview = previewPaperTradeLifecycleRun(p);

  assert.equal(preview.ok, true);
  assert.equal(preview.version, PAPER_TRADE_LIFECYCLE_RUNNER_VERSION);
  assert.equal(preview.mode, 'preview');
  assert.equal(preview.intentCreated, false);
  assert.equal(preview.ticketStored, false);
  assert.equal(preview.fillStored, false);
  assert.equal(preview.positionStored, false);
  assert.equal(preview.wroteAnyRecord, false);
  assert.equal(fs.existsSync(p.intentLedgerPath), false);
  assert.equal(fs.existsSync(p.ticketLedgerPath), false);
  assert.equal(fs.existsSync(p.fillLedgerPath), false);
  assert.equal(fs.existsSync(p.positionLedgerPath), false);
  assert.equal(preview.safety.brokerContact, false);
  assert.equal(preview.safety.orderPlacement, false);
  assert.equal(preview.safety.accountMutation, false);
});

test('paper lifecycle runner blocks safely when planner intent is not ready', () => {
  const p = paths();

  const result = runPaperTradeLifecycle({
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    plan: {
      readinessGateStatus: 'blocked'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'blocked_or_partial');
  assert.equal(result.lifecycleComplete, false);
  assert.equal(result.intentCreated, false);
  assert.equal(result.ticketStored, false);
  assert.equal(result.fillStored, false);
  assert.equal(result.positionStored, false);
  assert.equal(result.wroteAnyRecord, false);
  assert.equal(fs.existsSync(p.intentLedgerPath), false);
  assert.equal(fs.existsSync(p.ticketLedgerPath), false);
  assert.equal(fs.existsSync(p.fillLedgerPath), false);
  assert.equal(fs.existsSync(p.positionLedgerPath), false);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
});

test('paper lifecycle runner completes full local simulation when gates pass', () => {
  const p = paths();

  const result = runPaperTradeLifecycle({
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPrice: 101,
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1,
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 100
    }
  });

  assert.equal(result.status, 'complete_local_simulation');
  assert.equal(result.lifecycleComplete, true);
  assert.equal(result.intentCreated, true);
  assert.equal(result.ticketStored, true);
  assert.equal(result.fillStored, true);
  assert.equal(result.positionStored, true);
  assert.equal(result.wroteAnyRecord, true);
  assert.equal(result.stages.orderTicketStore.record.symbol, 'AAPL');
  assert.equal(result.stages.orderTicketStore.record.qty, '10');
  assert.equal(result.stages.fillSimulationStore.record.symbol, 'AAPL');
  assert.equal(result.stages.fillSimulationStore.record.qty, 10);
  assert.equal(result.stages.fillSimulationStore.record.fillPrice, 101);
  assert.equal(result.stages.positionStateStore.record.positionCount, 1);
  assert.equal(result.stages.positionStateStore.record.openPositionCount, 1);
  assert.equal(result.stages.positionStateStore.record.totalCostBasis, 1010);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);

  assert.equal(fs.existsSync(p.intentLedgerPath), true);
  assert.equal(fs.existsSync(p.ticketLedgerPath), true);
  assert.equal(fs.existsSync(p.fillLedgerPath), true);
  assert.equal(fs.existsSync(p.positionLedgerPath), true);
});

test('paper lifecycle runner panel exposes preview-only dashboard card', () => {
  const panel = readPaperTradeLifecycleRunnerPanel(paths());

  assert.equal(panel.ok, true);
  assert.equal(panel.version, 'paper_trade_lifecycle_runner_panel_v1');
  assert.equal(panel.panelType, 'operator_dashboard_card');
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.previewOnly, true);
  assert.equal(panel.summary.wroteAnyRecord, false);
  assert.equal(panel.safety.brokerContact, false);
  assert.equal(panel.safety.orderPlacement, false);
  assert.equal(panel.safety.accountMutation, false);
});


test('paper lifecycle runner treats an exact source intent replay as an idempotent no-op', () => {
  const p = paths();
  const options = {
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPrice: 101,
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1,
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 100
    }
  };

  const first = runPaperTradeLifecycle(options);
  const second = runPaperTradeLifecycle(options);

  assert.equal(first.status, 'complete_local_simulation');
  assert.equal(second.status, 'idempotent_replay_noop');
  assert.equal(second.lifecycleComplete, true);
  assert.equal(second.lifecycleReplayNoop, true);
  assert.equal(second.intentCreated, false);
  assert.equal(second.ticketStored, false);
  assert.equal(second.fillStored, false);
  assert.equal(second.positionStored, false);
  assert.equal(second.wroteAnyRecord, false);
  assert.equal(second.stages.intentCreation.creation.duplicateReason, 'intent_already_created');
  assert.equal(second.stages.orderTicketStore.duplicateReason, 'source_intent_already_ticketed');
  assert.equal(second.stages.fillSimulationStore.duplicateReason, 'source_ticket_already_filled');
  assert.equal(second.stages.positionStateStore.status, 'unchanged');
  assert.equal(second.stages.positionStateStore.unchanged, true);
  assert.equal(second.stages.positionStateStore.snapshotStored, false);
  assert.equal(second.stages.positionStateStore.wroteRecord, false);

  assert.equal(fs.readFileSync(p.intentLedgerPath, 'utf8').trim().split('\n').length, 1);
  assert.equal(fs.readFileSync(p.ticketLedgerPath, 'utf8').trim().split('\n').length, 1);
  assert.equal(fs.readFileSync(p.fillLedgerPath, 'utf8').trim().split('\n').length, 1);
  assert.equal(fs.readFileSync(p.positionLedgerPath, 'utf8').trim().split('\n').length, 1);
  assert.equal(second.safety.brokerContact, false);
  assert.equal(second.safety.orderPlacement, false);
  assert.equal(second.safety.accountMutation, false);
});


test('paper lifecycle runner resumes safely after intent-only partial failure', () => {
  const p = paths();
  const options = {
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPrice: 101,
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1,
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 100
    }
  };

  const first = runPaperTradeLifecycle(options);
  fs.rmSync(p.ticketLedgerPath);
  fs.rmSync(p.fillLedgerPath);
  fs.rmSync(p.positionLedgerPath);

  const resumed = runPaperTradeLifecycle(options);

  assert.equal(first.status, 'complete_local_simulation');
  assert.equal(resumed.status, 'recovered_partial_local_simulation');
  assert.equal(resumed.lifecycleComplete, true);
  assert.equal(resumed.lifecycleRecovered, true);
  assert.equal(resumed.lifecycleReplayNoop, false);
  assert.equal(resumed.stages.intentCreation.creation.duplicate, true);
  assert.equal(resumed.ticketStored, true);
  assert.equal(resumed.fillStored, true);
  assert.equal(resumed.positionStored, true);
  assert.equal(resumed.wroteAnyRecord, true);
  assert.equal(fs.readFileSync(p.intentLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.ticketLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.fillLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.positionLedgerPath, 'utf8').trim().split('\\n').length, 1);
});

test('paper lifecycle runner resumes safely after ticket-stage partial failure', () => {
  const p = paths();
  const options = {
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPrice: 101,
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1,
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 100
    }
  };

  runPaperTradeLifecycle(options);
  fs.rmSync(p.fillLedgerPath);
  fs.rmSync(p.positionLedgerPath);

  const resumed = runPaperTradeLifecycle(options);

  assert.equal(resumed.status, 'recovered_partial_local_simulation');
  assert.equal(resumed.lifecycleComplete, true);
  assert.equal(resumed.lifecycleRecovered, true);
  assert.equal(resumed.stages.intentCreation.creation.duplicate, true);
  assert.equal(resumed.stages.orderTicketStore.duplicate, true);
  assert.equal(resumed.fillStored, true);
  assert.equal(resumed.positionStored, true);
  assert.equal(resumed.wroteAnyRecord, true);
  assert.equal(fs.readFileSync(p.intentLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.ticketLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.fillLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.positionLedgerPath, 'utf8').trim().split('\\n').length, 1);
});

test('paper lifecycle runner rebuilds a missing position snapshot from an existing fill', () => {
  const p = paths();
  const options = {
    ...p,
    now: new Date('2026-06-26T12:00:00.000Z'),
    fillPrice: 101,
    paperEquity: 10000,
    riskPct: 0.005,
    stopPct: 0.02,
    maxNotionalPct: 0.1,
    plan: {
      readinessGateStatus: 'passed',
      candidateSymbol: 'AAPL',
      action: 'buy',
      entryPrice: 100
    }
  };

  runPaperTradeLifecycle(options);
  fs.rmSync(p.positionLedgerPath);

  const resumed = runPaperTradeLifecycle(options);

  assert.equal(resumed.status, 'recovered_partial_local_simulation');
  assert.equal(resumed.lifecycleComplete, true);
  assert.equal(resumed.lifecycleRecovered, true);
  assert.equal(resumed.stages.intentCreation.creation.duplicate, true);
  assert.equal(resumed.stages.orderTicketStore.duplicate, true);
  assert.equal(resumed.stages.fillSimulationStore.duplicate, true);
  assert.equal(resumed.positionStored, true);
  assert.equal(resumed.stages.positionStateStore.snapshotStored, true);
  assert.equal(resumed.wroteAnyRecord, true);
  assert.equal(fs.readFileSync(p.intentLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.ticketLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.fillLedgerPath, 'utf8').trim().split('\\n').length, 1);
  assert.equal(fs.readFileSync(p.positionLedgerPath, 'utf8').trim().split('\\n').length, 1);
});
