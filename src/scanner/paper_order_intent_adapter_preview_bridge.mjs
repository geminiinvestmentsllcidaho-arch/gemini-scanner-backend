import {
  validatePaperBrokerOrderRequest,
  normalizePaperBrokerOrderRequest
} from './paper_broker_adapter_contract.mjs';

import {
  previewPaperBrokerNullOrder
} from './paper_broker_null_adapter.mjs';

export const PAPER_ORDER_INTENT_ADAPTER_PREVIEW_BRIDGE_VERSION = 'paper_order_intent_adapter_preview_bridge_v1';

function cleanString(value) {
  return String(value ?? '').trim();
}

function cleanSymbol(value) {
  return cleanString(value).toUpperCase();
}

function cleanLower(value) {
  return cleanString(value).toLowerCase();
}

function cleanNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function uniqueReasons(values = []) {
  return [...new Set(values.map((v) => cleanString(v)).filter(Boolean))];
}

function getNested(obj, paths = []) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function normalizeIntentSide(value) {
  const side = cleanLower(value);
  if (side === 'buy' || side === 'long' || side === 'entry') return 'buy';
  if (side === 'sell' || side === 'short' || side === 'exit') return 'sell';
  return side;
}

export function extractPaperOrderRequestFromIntent(intent = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();

  const symbol = cleanSymbol(getNested(intent, [
    'symbol',
    'candidateSymbol',
    'candidate.symbol',
    'ranking.symbol',
    'paperTradeIntent.symbol',
    'intent.symbol'
  ]) ?? options.symbol);

  const side = normalizeIntentSide(getNested(intent, [
    'side',
    'action',
    'tradeSide',
    'orderSide',
    'paperTradeIntent.side',
    'paperTradeIntent.action',
    'intent.side',
    'intent.action'
  ]) ?? options.side);

  const qty = cleanNumber(getNested(intent, [
    'qty',
    'quantity',
    'shares',
    'orderQty',
    'plannedQty',
    'paperTradeIntent.qty',
    'paperTradeIntent.quantity',
    'intent.qty',
    'intent.quantity'
  ]) ?? options.qty);

  const notional = cleanNumber(getNested(intent, [
    'notional',
    'dollarAmount',
    'orderNotional',
    'plannedNotional',
    'paperTradeIntent.notional',
    'intent.notional'
  ]) ?? options.notional);

  const orderType = cleanLower(getNested(intent, [
    'orderType',
    'type',
    'paperTradeIntent.orderType',
    'intent.orderType'
  ]) ?? options.orderType ?? 'market');

  const timeInForce = cleanLower(getNested(intent, [
    'timeInForce',
    'time_in_force',
    'tif',
    'paperTradeIntent.timeInForce',
    'intent.timeInForce'
  ]) ?? options.timeInForce ?? 'day');

  const limitPrice = cleanNumber(getNested(intent, [
    'limitPrice',
    'limit_price',
    'paperTradeIntent.limitPrice',
    'intent.limitPrice'
  ]) ?? options.limitPrice);

  const stopPrice = cleanNumber(getNested(intent, [
    'stopPrice',
    'stop_price',
    'paperTradeIntent.stopPrice',
    'intent.stopPrice'
  ]) ?? options.stopPrice);

  const auditId = cleanString(getNested(intent, [
    'auditId',
    'audit_id',
    'intentAuditId',
    'paperTradeIntent.auditId',
    'intent.auditId'
  ]) ?? options.auditId) || `paper-intent-preview-${symbol || 'UNKNOWN'}-${nowMs}`;

  return normalizePaperBrokerOrderRequest({
    symbol,
    side,
    qty,
    notional,
    orderType,
    timeInForce,
    limitPrice,
    stopPrice,
    auditId
  }, { nowMs });
}

export function summarizePaperIntent(intent = {}) {
  const status = cleanLower(getNested(intent, [
    'status',
    'paperTradeIntentStatus',
    'intentStatus',
    'paperTradeIntent.status',
    'intent.status'
  ]) ?? 'unknown');

  const blocked = Boolean(getNested(intent, [
    'blocked',
    'paperTradeIntent.blocked',
    'intent.blocked'
  ]) ?? status === 'blocked');

  const reasons = uniqueReasons([
    ...(Array.isArray(intent.blockReasons) ? intent.blockReasons : []),
    ...(Array.isArray(intent.reasons) ? intent.reasons : []),
    ...(Array.isArray(intent.latestReasons) ? intent.latestReasons : []),
    ...(Array.isArray(intent.paperTradeIntent?.blockReasons) ? intent.paperTradeIntent.blockReasons : []),
    ...(Array.isArray(intent.intent?.blockReasons) ? intent.intent.blockReasons : [])
  ]);

  return Object.freeze({
    status,
    blocked,
    reasonCount: reasons.length,
    reasons
  });
}

export function previewPaperOrderIntentThroughAdapterBridge(intent = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const request = extractPaperOrderRequestFromIntent(intent, options);
  const intentSummary = summarizePaperIntent(intent);
  const contractValidation = validatePaperBrokerOrderRequest(request);
  const nullAdapterPreview = previewPaperBrokerNullOrder(request, { nowMs });

  const bridgeReasons = uniqueReasons([
    'intent_adapter_preview_bridge_diagnostics_only',
    'broker_contact_blocked_by_null_adapter',
    ...intentSummary.reasons,
    ...contractValidation.blockReasons,
    ...(nullAdapterPreview.preview?.blockReasons ?? [])
  ]);

  return Object.freeze({
    ok: true,
    version: PAPER_ORDER_INTENT_ADAPTER_PREVIEW_BRIDGE_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    bridgeKind: 'intent_to_null_adapter_preview',
    adapterKind: 'null',
    brokerContactAllowed: false,
    brokerIntegrationAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    intent: intentSummary,
    request,
    contract: Object.freeze({
      ok: contractValidation.ok,
      version: contractValidation.contractVersion,
      blockReasons: contractValidation.blockReasons
    }),
    adapterPreview: Object.freeze({
      version: nullAdapterPreview.version,
      previewStatus: 'blocked',
      blocked: true,
      wouldContactBroker: false,
      wouldPlaceOrder: false,
      wouldMutateAccount: false,
      blockReasons: bridgeReasons
    }),
    ts: new Date(nowMs).toISOString()
  });
}

async function tryLoadExistingIntentSource(options = {}) {
  try {
    const planner = await import('./paper_trade_intent_planner.mjs');
    const fnNames = [
      'getPaperTradeIntentPlannerDiagnostics',
      'getPaperTradeIntentPlannerSnapshot',
      'planPaperTradeIntent',
      'buildPaperTradeIntentPlan',
      'getPaperTradeIntentPlan'
    ];

    for (const fnName of fnNames) {
      if (typeof planner[fnName] !== 'function') continue;
      const raw = await planner[fnName](options);
      const intent = raw?.paperTradeIntent ?? raw?.intent ?? raw?.plan ?? raw?.latestIntent ?? raw;
      return {
        sourceAvailable: true,
        sourceModule: 'paper_trade_intent_planner',
        sourceFunction: fnName,
        raw,
        intent
      };
    }
  } catch {
    return {
      sourceAvailable: false,
      sourceModule: 'paper_trade_intent_planner',
      sourceFunction: null,
      raw: null,
      intent: null
    };
  }

  return {
    sourceAvailable: false,
    sourceModule: 'paper_trade_intent_planner',
    sourceFunction: null,
    raw: null,
    intent: null
  };
}

export async function getPaperOrderIntentAdapterPreviewBridgeDiagnostics(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const loaded = await tryLoadExistingIntentSource(options);

  const fallbackIntent = {
    status: 'blocked',
    blockReasons: ['fallback_diagnostic_intent_used'],
    symbol: options.symbol ?? 'AAPL',
    side: options.side ?? 'buy',
    qty: options.qty ?? 1,
    orderType: options.orderType ?? 'market',
    timeInForce: options.timeInForce ?? 'day'
  };

  const bridge = previewPaperOrderIntentThroughAdapterBridge(
    loaded.intent ?? fallbackIntent,
    {
      ...options,
      nowMs,
      symbol: options.symbol,
      side: options.side,
      qty: options.qty,
      notional: options.notional,
      orderType: options.orderType,
      timeInForce: options.timeInForce
    }
  );

  return Object.freeze({
    ...bridge,
    source: Object.freeze({
      sourceAvailable: loaded.sourceAvailable,
      sourceModule: loaded.sourceModule,
      sourceFunction: loaded.sourceFunction
    })
  });
}

export default {
  PAPER_ORDER_INTENT_ADAPTER_PREVIEW_BRIDGE_VERSION,
  extractPaperOrderRequestFromIntent,
  summarizePaperIntent,
  previewPaperOrderIntentThroughAdapterBridge,
  getPaperOrderIntentAdapterPreviewBridgeDiagnostics
};
