export const PAPER_BROKER_ADAPTER_CONTRACT_VERSION = 'paper_broker_adapter_contract_v1';

export const PAPER_BROKER_ALLOWED_SIDES = Object.freeze(['buy', 'sell']);
export const PAPER_BROKER_ALLOWED_ORDER_TYPES = Object.freeze(['market', 'limit', 'stop', 'stop_limit']);
export const PAPER_BROKER_ALLOWED_TIME_IN_FORCE = Object.freeze(['day', 'gtc', 'opg', 'cls', 'ioc', 'fok']);
export const PAPER_BROKER_ALLOWED_PREVIEW_STATUSES = Object.freeze(['blocked', 'preview_ready', 'submitted', 'rejected']);

function cleanString(value) {
  return String(value ?? '').trim();
}

function cleanSymbol(value) {
  return cleanString(value).toUpperCase();
}

function cleanSide(value) {
  return cleanString(value).toLowerCase();
}

function cleanOrderType(value) {
  return cleanString(value).toLowerCase() || 'market';
}

function cleanTimeInForce(value) {
  return cleanString(value).toLowerCase() || 'day';
}

function cleanPreviewStatus(value) {
  return cleanString(value).toLowerCase() || 'blocked';
}

function cleanNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanBlockReasons(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => cleanString(v)).filter(Boolean))];
}

export function buildPaperBrokerAuditId({ nowMs = Date.now(), symbol = 'UNKNOWN', source = 'contract' } = {}) {
  const safeSource = cleanString(source).toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'contract';
  const safeSymbol = cleanSymbol(symbol) || 'UNKNOWN';
  return `paper-broker-${safeSource}-${safeSymbol}-${nowMs}`;
}

export function normalizePaperBrokerOrderRequest(input = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const symbol = cleanSymbol(input.symbol);
  const side = cleanSide(input.side);
  const qty = cleanNumber(input.qty);
  const notional = cleanNumber(input.notional);
  const orderType = cleanOrderType(input.orderType ?? input.type);
  const timeInForce = cleanTimeInForce(input.timeInForce ?? input.time_in_force);
  const limitPrice = cleanNumber(input.limitPrice ?? input.limit_price);
  const stopPrice = cleanNumber(input.stopPrice ?? input.stop_price);
  const auditId = cleanString(input.auditId ?? input.audit_id) || buildPaperBrokerAuditId({ nowMs, symbol });

  return Object.freeze({
    contractVersion: PAPER_BROKER_ADAPTER_CONTRACT_VERSION,
    symbol,
    side,
    qty,
    notional,
    orderType,
    timeInForce,
    limitPrice,
    stopPrice,
    auditId
  });
}

export function validatePaperBrokerOrderRequest(request = {}) {
  const normalized = normalizePaperBrokerOrderRequest(request, { nowMs: 1700000000000 });
  const blockReasons = [];

  if (!normalized.symbol) blockReasons.push('symbol_missing');
  if (!PAPER_BROKER_ALLOWED_SIDES.includes(normalized.side)) blockReasons.push('side_not_tradeable');
  if (normalized.qty === null && normalized.notional === null) blockReasons.push('qty_or_notional_missing');
  if (normalized.qty !== null && normalized.qty <= 0) blockReasons.push('qty_not_positive');
  if (normalized.notional !== null && normalized.notional <= 0) blockReasons.push('notional_not_positive');
  if (normalized.qty !== null && normalized.notional !== null) blockReasons.push('qty_and_notional_both_present');
  if (!PAPER_BROKER_ALLOWED_ORDER_TYPES.includes(normalized.orderType)) blockReasons.push('order_type_invalid');
  if (!PAPER_BROKER_ALLOWED_TIME_IN_FORCE.includes(normalized.timeInForce)) blockReasons.push('time_in_force_invalid');
  if ((normalized.orderType === 'limit' || normalized.orderType === 'stop_limit') && (normalized.limitPrice === null || normalized.limitPrice <= 0)) blockReasons.push('limit_price_missing');
  if ((normalized.orderType === 'stop' || normalized.orderType === 'stop_limit') && (normalized.stopPrice === null || normalized.stopPrice <= 0)) blockReasons.push('stop_price_missing');

  return Object.freeze({
    ok: blockReasons.length === 0,
    contractVersion: PAPER_BROKER_ADAPTER_CONTRACT_VERSION,
    normalized,
    blockReasons
  });
}

export function buildPaperBrokerAdapterPreviewResponse({
  request = {},
  previewStatus = 'blocked',
  blockReasons = [],
  adapterKind = 'contract',
  brokerContactAllowed = false,
  orderPlacementAllowed = false,
  accountMutationAllowed = false,
  nowMs = Date.now()
} = {}) {
  const normalizedRequest = normalizePaperBrokerOrderRequest(request, { nowMs });
  const requestValidation = validatePaperBrokerOrderRequest(normalizedRequest);
  const status = cleanPreviewStatus(previewStatus);
  const safeStatus = PAPER_BROKER_ALLOWED_PREVIEW_STATUSES.includes(status) ? status : 'blocked';

  const safetyReasons = [];
  if (!brokerContactAllowed) safetyReasons.push('broker_contact_not_allowed');
  if (!orderPlacementAllowed) safetyReasons.push('order_placement_not_allowed');
  if (!accountMutationAllowed) safetyReasons.push('account_mutation_not_allowed');

  const finalBlockReasons = cleanBlockReasons([
    ...requestValidation.blockReasons,
    ...blockReasons,
    ...safetyReasons
  ]);

  const blocked = safeStatus === 'blocked' || finalBlockReasons.length > 0 || !brokerContactAllowed || !orderPlacementAllowed || !accountMutationAllowed;

  return Object.freeze({
    ok: true,
    version: PAPER_BROKER_ADAPTER_CONTRACT_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    adapterKind: cleanString(adapterKind) || 'contract',
    brokerContactAllowed: Boolean(brokerContactAllowed),
    orderPlacementAllowed: Boolean(orderPlacementAllowed),
    accountMutationAllowed: Boolean(accountMutationAllowed),
    request: normalizedRequest,
    preview: Object.freeze({
      previewStatus: blocked ? 'blocked' : safeStatus,
      blocked,
      blockReasons: finalBlockReasons,
      wouldContactBroker: Boolean(brokerContactAllowed) && !blocked,
      wouldPlaceOrder: Boolean(orderPlacementAllowed) && !blocked,
      wouldMutateAccount: Boolean(accountMutationAllowed) && !blocked
    }),
    ts: new Date(nowMs).toISOString()
  });
}

export function getPaperBrokerAdapterContractDiagnostics(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();

  return buildPaperBrokerAdapterPreviewResponse({
    request: {
      symbol: options.symbol ?? 'AAPL',
      side: options.side ?? 'buy',
      qty: options.qty ?? 1,
      notional: options.notional,
      orderType: options.orderType ?? 'market',
      timeInForce: options.timeInForce ?? 'day',
      auditId: options.auditId
    },
    previewStatus: 'blocked',
    blockReasons: ['contract_diagnostics_only'],
    adapterKind: 'contract',
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    nowMs
  });
}

export default {
  PAPER_BROKER_ADAPTER_CONTRACT_VERSION,
  PAPER_BROKER_ALLOWED_SIDES,
  PAPER_BROKER_ALLOWED_ORDER_TYPES,
  PAPER_BROKER_ALLOWED_TIME_IN_FORCE,
  PAPER_BROKER_ALLOWED_PREVIEW_STATUSES,
  buildPaperBrokerAuditId,
  normalizePaperBrokerOrderRequest,
  validatePaperBrokerOrderRequest,
  buildPaperBrokerAdapterPreviewResponse,
  getPaperBrokerAdapterContractDiagnostics
};
