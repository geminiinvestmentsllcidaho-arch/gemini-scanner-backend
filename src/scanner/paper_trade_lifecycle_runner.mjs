import { runPaperTradeIntentCreation } from './paper_trade_intent_creation_runner.mjs';
import {
  DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH
} from './paper_trade_intent_creation_store.mjs';
import { buildPaperTradeOrderTicketPreview } from './paper_trade_order_ticket_preview.mjs';
import {
  DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH,
  storePaperTradeOrderTicket
} from './paper_trade_order_ticket_store.mjs';
import { buildPaperTradeFillSimulationPreview } from './paper_trade_fill_simulation_preview.mjs';
import {
  DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH,
  storePaperTradeFillSimulation
} from './paper_trade_fill_simulation_store.mjs';
import { buildPaperTradePositionStatePreview } from './paper_trade_position_state_preview.mjs';
import {
  DEFAULT_PAPER_TRADE_POSITION_STATE_LEDGER_PATH,
  storePaperTradePositionState
} from './paper_trade_position_state_store.mjs';

export const PAPER_TRADE_LIFECYCLE_RUNNER_VERSION =
  'paper_trade_lifecycle_runner_v1';

function nowDate(value) {
  return value instanceof Date ? value : new Date();
}

function resolvePaths(options = {}) {
  return {
    intentLedgerPath:
      options.intentLedgerPath || DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH,
    ticketLedgerPath:
      options.ticketLedgerPath || DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH,
    fillLedgerPath:
      options.fillLedgerPath || DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH,
    positionLedgerPath:
      options.positionLedgerPath || DEFAULT_PAPER_TRADE_POSITION_STATE_LEDGER_PATH
  };
}

function blockedStage(name, status, reasons = []) {
  return {
    stage: name,
    status,
    wroteRecord: false,
    reasons
  };
}

export function previewPaperTradeLifecycleRun(options = {}) {
  const paths = resolvePaths(options);

  const ticketPreview = buildPaperTradeOrderTicketPreview({
    ledgerPath: paths.intentLedgerPath,
    paperEquity: options.paperEquity,
    riskPct: options.riskPct,
    stopPct: options.stopPct,
    maxNotionalPct: options.maxNotionalPct
  });

  const fillReferencePrice =
    Number(options.fillPrice) > 0
      ? Number(options.fillPrice)
      : ticketPreview.normalized?.entryReferencePrice || null;

  const fillPreview = buildPaperTradeFillSimulationPreview({
    ledgerPath: paths.ticketLedgerPath,
    fillPrice: fillReferencePrice
  });

  const positionPreview = buildPaperTradePositionStatePreview({
    ledgerPath: paths.fillLedgerPath
  });

  return {
    ok: true,
    version: PAPER_TRADE_LIFECYCLE_RUNNER_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    mode: 'preview',
    status:
      ticketPreview.ticketReady && fillPreview.fillReady
        ? 'ready'
        : 'blocked',
    paths,
    stages: {
      orderTicketPreview: ticketPreview,
      fillSimulationPreview: fillPreview,
      positionStatePreview: positionPreview
    },
    intentCreated: false,
    ticketStored: false,
    fillStored: false,
    positionStored: false,
    wroteAnyRecord: false,
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
      localJsonlOnly: true
    }
  };
}

export function runPaperTradeLifecycle(options = {}) {
  const paths = resolvePaths(options);
  const now = nowDate(options.now);

  const intentRun = runPaperTradeIntentCreation({
    ledgerPath: paths.intentLedgerPath,
    now,
    plan: options.plan,
    plannerOptions: options.plannerOptions
  });

  const ticketPreview = buildPaperTradeOrderTicketPreview({
    ledgerPath: paths.intentLedgerPath,
    paperEquity: options.paperEquity,
    riskPct: options.riskPct,
    stopPct: options.stopPct,
    maxNotionalPct: options.maxNotionalPct
  });

  const ticketStore = storePaperTradeOrderTicket({
    ledgerPath: paths.ticketLedgerPath,
    now,
    ticketPreview
  });

  const fillReferencePrice =
    Number(options.fillPrice) > 0
      ? Number(options.fillPrice)
      : ticketPreview.normalized?.entryReferencePrice || null;

  const fillPreview = buildPaperTradeFillSimulationPreview({
    ledgerPath: paths.ticketLedgerPath,
    fillPrice: fillReferencePrice
  });

  const fillStore = storePaperTradeFillSimulation({
    ledgerPath: paths.fillLedgerPath,
    now,
    fillPreview
  });

  const positionPreview = buildPaperTradePositionStatePreview({
    ledgerPath: paths.fillLedgerPath
  });

  const fillStageSatisfied =
    fillStore.fillStored === true || fillStore.duplicate === true;

  const positionStore =
    fillStageSatisfied
      ? storePaperTradePositionState({
          storeLedgerPath: paths.positionLedgerPath,
          now,
          positionPreview
        })
      : blockedStage('position_state_store', 'blocked', [
          'fill_simulation_not_available'
        ]);

  const intentStageSatisfied =
    intentRun.intentCreated === true || intentRun.creation?.duplicate === true;
  const ticketStageSatisfied =
    ticketStore.ticketStored === true || ticketStore.duplicate === true;
  const positionStageSatisfied =
    positionStore.snapshotStored === true || positionStore.unchanged === true;

  const lifecycleComplete =
    intentStageSatisfied &&
    ticketStageSatisfied &&
    fillStageSatisfied &&
    positionStageSatisfied;

  const lifecycleRecovered =
    lifecycleComplete &&
    (
      intentRun.creation?.duplicate === true ||
      ticketStore.duplicate === true ||
      fillStore.duplicate === true
    ) &&
    (
      ticketStore.wroteRecord === true ||
      fillStore.wroteRecord === true ||
      positionStore.wroteRecord === true
    );

  const lifecycleReplayNoop =
    lifecycleComplete &&
    intentRun.creation?.duplicate === true &&
    ticketStore.duplicate === true &&
    fillStore.duplicate === true &&
    positionStore.unchanged === true &&
    positionStore.wroteRecord === false;

  return {
    ok: true,
    version: PAPER_TRADE_LIFECYCLE_RUNNER_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    mode: 'local_lifecycle_run',
    status: lifecycleReplayNoop
      ? 'idempotent_replay_noop'
      : lifecycleRecovered
        ? 'recovered_partial_local_simulation'
        : lifecycleComplete
          ? 'complete_local_simulation'
          : 'blocked_or_partial',
    paths,
    lifecycleComplete,
    lifecycleRecovered,
    lifecycleReplayNoop,
    intentCreated: intentRun.intentCreated === true,
    ticketStored: ticketStore.ticketStored === true,
    fillStored: fillStore.fillStored === true,
    positionStored: positionStore.snapshotStored === true,
    wroteAnyRecord:
      intentRun.wroteRecord === true ||
      ticketStore.wroteRecord === true ||
      fillStore.wroteRecord === true ||
      positionStore.wroteRecord === true,
    stages: {
      intentCreation: intentRun,
      orderTicketPreview: ticketPreview,
      orderTicketStore: ticketStore,
      fillSimulationPreview: fillPreview,
      fillSimulationStore: fillStore,
      positionStatePreview: positionPreview,
      positionStateStore: positionStore
    },
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
      localJsonlOnly: true
    }
  };
}

export function readPaperTradeLifecycleRunnerPanel(options = {}) {
  const preview = previewPaperTradeLifecycleRun(options);

  return {
    ok: true,
    version: 'paper_trade_lifecycle_runner_panel_v1',
    runnerVersion: preview.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Lifecycle Runner',
    route: '/diagnostics/paper-trade-lifecycle-runner',
    refreshRoute: '/diagnostics/paper-trade-lifecycle-runner-panel',
    status: preview.status,
    severity: preview.status === 'ready' ? 'info' : 'blocked',
    summary: {
      mode: preview.mode,
      ticketReady: preview.stages.orderTicketPreview.ticketReady,
      fillReady: preview.stages.fillSimulationPreview.fillReady,
      positionCount: preview.stages.positionStatePreview.positionCount,
      openPositionCount: preview.stages.positionStatePreview.openPositionCount,
      wroteAnyRecord: false
    },
    badges: [
      { label: 'Preview Only', value: true },
      { label: 'Monitor Only', value: true },
      { label: 'Local JSONL Only', value: true },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: preview.safety
  };
}
