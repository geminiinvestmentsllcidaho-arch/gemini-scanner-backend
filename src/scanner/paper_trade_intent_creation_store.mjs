import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const PAPER_TRADE_INTENT_CREATION_STORE_VERSION = 'paper_trade_intent_creation_store_v1';

export const DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH =
  process.env.PAPER_TRADE_INTENT_CREATION_LEDGER_PATH ||
  path.join(process.cwd(), 'runs', 'paper_trade_intent_creation_store.jsonl');

const TRADEABLE_ACTIONS = new Set(['buy', 'sell']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeSymbol(input) {
  const obj = asObject(input);
  const candidate = asObject(obj.candidate);
  const plan = asObject(obj.plan);

  const raw = firstDefined(
    obj.candidateSymbol,
    obj.symbol,
    candidate.symbol,
    plan.symbol,
    obj.ticker
  );

  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

function normalizeAction(input) {
  const obj = asObject(input);
  const candidate = asObject(obj.candidate);
  const plan = asObject(obj.plan);

  const raw = firstDefined(
    obj.action,
    obj.tradeAction,
    candidate.action,
    candidate.tradeAction,
    plan.action,
    plan.tradeAction
  );

  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function normalizeEntryPrice(input) {
  const obj = asObject(input);
  const candidate = asObject(obj.candidate);
  const plan = asObject(obj.plan);

  const raw = firstDefined(
    obj.entryPrice,
    obj.entry,
    obj.price,
    candidate.entryPrice,
    candidate.entry,
    candidate.price,
    plan.entryPrice,
    plan.entry,
    plan.price
  );

  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeReadinessGateOk(input) {
  const obj = asObject(input);
  const readinessGate = asObject(obj.readinessGate);

  if (obj.readinessGateOk === true) return true;
  if (obj.ready === true) return true;
  if (obj.canCreateIntent === true) return true;
  if (readinessGate.ok === true) return true;

  const status = firstDefined(
    obj.readinessGateStatus,
    obj.gateStatus,
    readinessGate.status
  );

  return typeof status === 'string' && ['passed', 'pass', 'ready', 'ok'].includes(status.trim().toLowerCase());
}

export function evaluatePaperTradeIntentCreation(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const symbol = normalizeSymbol(input);
  const action = normalizeAction(input);
  const entryPrice = normalizeEntryPrice(input);
  const readinessGateOk = normalizeReadinessGateOk(input);

  const reasons = [];

  if (!readinessGateOk) reasons.push('readiness_gate_blocked');
  if (!symbol) reasons.push('candidate_symbol_missing');
  if (!TRADEABLE_ACTIONS.has(action)) reasons.push('action_not_tradeable');
  if (entryPrice === null) reasons.push('entry_price_missing');

  const intentWouldBeCreated = reasons.length === 0;
  const createdAt = now.toISOString();

  const intent = intentWouldBeCreated
    ? {
        intentId: `paper_intent_${crypto
          .createHash('sha256')
          .update(`${symbol}:${action}:${entryPrice}:${createdAt}`)
          .digest('hex')
          .slice(0, 16)}`,
        symbol,
        action,
        entryPrice,
        createdAt,
        monitorOnly: true,
        brokerContact: false,
        orderPlacement: false,
        accountMutation: false,
        executionRequested: false,
        source: options.source || input.source || 'paper_trade_intent_creation_store'
      }
    : null;

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_STORE_VERSION,
    monitorOnly: true,
    status: intentWouldBeCreated ? 'created' : 'blocked',
    blocked: !intentWouldBeCreated,
    intentWouldBeCreated,
    intentCreated: false,
    reasonCount: reasons.length,
    reasons,
    normalized: {
      readinessGateOk,
      symbol,
      action,
      entryPrice
    },
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
      localJsonlOnly: true
    },
    intent
  };
}

export function readPaperTradeIntentCreationRecords(ledgerPath = DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH) {
  if (!fs.existsSync(ledgerPath)) return [];

  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function createPaperTradeIntent(input = {}, options = {}) {
  const ledgerPath = options.ledgerPath || DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH;
  const evaluated = evaluatePaperTradeIntentCreation(input, options);

  if (!evaluated.intentWouldBeCreated) {
    return {
      ...evaluated,
      ledgerPath,
      intentCreated: false,
      wroteRecord: false,
      recordCount: readPaperTradeIntentCreationRecords(ledgerPath).length
    };
  }

  const existingRecords = readPaperTradeIntentCreationRecords(ledgerPath);
  const duplicateRecord = existingRecords.find(
    (record) => record?.intentId === evaluated.intent?.intentId
  );

  if (duplicateRecord) {
    return {
      ...evaluated,
      status: 'duplicate',
      blocked: false,
      ledgerPath,
      intentCreated: false,
      wroteRecord: false,
      duplicate: true,
      duplicateReason: 'intent_already_created',
      reasonCount: 1,
      reasons: ['intent_already_created'],
      recordCount: existingRecords.length,
      record: duplicateRecord
    };
  }

  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });

  const record = {
    ...evaluated.intent,
    version: PAPER_TRADE_INTENT_CREATION_STORE_VERSION
  };

  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);

  return {
    ...evaluated,
    ledgerPath,
    intentCreated: true,
    wroteRecord: true,
    duplicate: false,
    recordCount: existingRecords.length + 1,
    record
  };
}
