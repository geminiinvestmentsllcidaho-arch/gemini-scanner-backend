import { getPaperTradeIntentPlan } from './paper_trade_intent_planner.mjs';
import {
  DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH,
  createPaperTradeIntent,
  evaluatePaperTradeIntentCreation
} from './paper_trade_intent_creation_store.mjs';

export const PAPER_TRADE_INTENT_CREATION_RUNNER_VERSION =
  'paper_trade_intent_creation_runner_v1';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

export function buildPaperTradeIntentCreationInput(plan = {}) {
  const obj = asObject(plan);
  const candidate = asObject(obj.candidate);
  const intent = asObject(obj.intent);
  const paperTradeIntent = asObject(obj.paperTradeIntent);
  const readinessGate = asObject(obj.readinessGate);
  const decision = asObject(obj.decision);
  const planner = asObject(obj.planner);

  return {
    readinessGateOk: firstDefined(
      obj.readinessGateOk,
      obj.canCreateIntent,
      obj.intentWouldBeCreated,
      readinessGate.ok,
      planner.readinessGateOk
    ),
    readinessGateStatus: firstDefined(
      obj.readinessGateStatus,
      obj.gateStatus,
      readinessGate.status,
      planner.readinessGateStatus
    ),
    canCreateIntent: firstDefined(
      obj.canCreateIntent,
      obj.intentWouldBeCreated,
      planner.canCreateIntent
    ),
    candidateSymbol: firstDefined(
      obj.candidateSymbol,
      obj.symbol,
      candidate.symbol,
      paperTradeIntent.symbol,
      intent.symbol,
      decision.symbol,
      planner.symbol
    ),
    action: firstDefined(
      obj.action,
      obj.tradeAction,
      candidate.action,
      candidate.tradeAction,
      paperTradeIntent.action,
      paperTradeIntent.tradeAction,
      intent.action,
      intent.tradeAction,
      decision.action,
      planner.action
    ),
    entryPrice: firstDefined(
      obj.entryPrice,
      obj.entry,
      obj.price,
      candidate.entryPrice,
      candidate.entry,
      candidate.price,
      paperTradeIntent.entryPrice,
      paperTradeIntent.entry,
      paperTradeIntent.price,
      intent.entryPrice,
      intent.entry,
      intent.price,
      decision.entryPrice,
      planner.entryPrice
    ),
    source: 'paper_trade_intent_creation_runner'
  };
}

export function previewPaperTradeIntentCreationFromPlan(plan = {}, options = {}) {
  const input = buildPaperTradeIntentCreationInput(plan);
  const evaluated = evaluatePaperTradeIntentCreation(input, {
    now: options.now,
    source: 'paper_trade_intent_creation_runner'
  });

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_RUNNER_VERSION,
    monitorOnly: true,
    mode: 'preview',
    plannerVersion: plan?.version || null,
    plannerStatus: plan?.paperTradeIntentStatus || plan?.status || null,
    plannerReasons: plan?.latestReasons || plan?.reasons || plan?.blockReasons || [],
    input,
    creation: evaluated,
    intentWouldBeCreated: evaluated.intentWouldBeCreated,
    intentCreated: false,
    wroteRecord: false,
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

export function runPaperTradeIntentCreation(options = {}) {
  const plan = options.plan || getPaperTradeIntentPlan(options.plannerOptions || {});
  const input = buildPaperTradeIntentCreationInput(plan);

  const creation = createPaperTradeIntent(input, {
    ledgerPath:
      options.ledgerPath || DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH,
    now: options.now,
    source: 'paper_trade_intent_creation_runner'
  });

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_RUNNER_VERSION,
    monitorOnly: true,
    mode: 'create_local_intent_if_ready',
    plannerVersion: plan?.version || null,
    plannerStatus: plan?.paperTradeIntentStatus || plan?.status || null,
    plannerReasons: plan?.latestReasons || plan?.reasons || plan?.blockReasons || [],
    input,
    creation,
    status: creation.status,
    intentWouldBeCreated: creation.intentWouldBeCreated,
    intentCreated: creation.intentCreated,
    wroteRecord: creation.wroteRecord,
    recordCount: creation.recordCount,
    ledgerPath: creation.ledgerPath,
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
