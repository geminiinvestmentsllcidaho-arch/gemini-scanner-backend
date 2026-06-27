export const PAPER_BROKER_NULL_ADAPTER_VERSION = 'paper_broker_null_adapter_v1';

const SAFE_ORDER_TYPES = new Set(['market', 'limit', 'stop', 'stop_limit']);
const SAFE_TIME_IN_FORCE = new Set(['day', 'gtc', 'opg', 'cls', 'ioc', 'fok']);

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
  const orderType = cleanString(value).toLowerCase() || 'market';
  return SAFE_ORDER_TYPES.has(orderType) ? orderType : 'invalid';
}

function cleanTimeInForce(value) {
  const tif = cleanString(value).toLowerCase() || 'day';
  return SAFE_TIME_IN_FORCE.has(tif) ? tif : 'invalid';
}

function cleanNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildAuditId({ nowMs = Date.now(), symbol = 'UNKNOWN' } = {}) {
  const safeSymbol = cleanSymbol(symbol) || 'UNKNOWN';
  return `null-paper-${safeSymbol}-${nowMs}`;
}

export function previewPaperBrokerNullOrder(input = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();

  const symbol = cleanSymbol(input.symbol);
  const side = cleanSide(input.side);
  const qty = cleanNumber(input.qty);
  const notional = cleanNumber(input.notional);
  const orderType = cleanOrderType(input.orderType ?? input.type);
  const timeInForce = cleanTimeInForce(input.timeInForce ?? input.time_in_force);
  const limitPrice = cleanNumber(input.limitPrice ?? input.limit_price);
  const stopPrice = cleanNumber(input.stopPrice ?? input.stop_price);
  const auditId = cleanString(input.auditId ?? input.audit_id) || buildAuditId({ nowMs, symbol });

  const blockReasons = [
    'null_adapter_blocks_all_broker_contact',
    'order_placement_disabled',
    'account_mutation_disabled'
  ];

  if (!symbol) blockReasons.push('symbol_missing');
  if (!['buy', 'sell'].includes(side)) blockReasons.push('side_not_tradeable');
  if (qty === null && notional === null) blockReasons.push('qty_or_notional_missing');
  if (qty !== null && qty <= 0) blockReasons.push('qty_not_positive');
  if (notional !== null && notional <= 0) blockReasons.push('notional_not_positive');
  if (qty !== null && notional !== null) blockReasons.push('qty_and_notional_both_present');
  if (orderType === 'invalid') blockReasons.push('order_type_invalid');
  if (timeInForce === 'invalid') blockReasons.push('time_in_force_invalid');
  if ((orderType === 'limit' || orderType === 'stop_limit') && (limitPrice === null || limitPrice <= 0)) blockReasons.push('limit_price_missing');
  if ((orderType === 'stop' || orderType === 'stop_limit') && (stopPrice === null || stopPrice <= 0)) blockReasons.push('stop_price_missing');

  return {
    ok: true,
    version: PAPER_BROKER_NULL_ADAPTER_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    adapterKind: 'null',
    adapterEnabled: true,
    brokerContactAllowed: false,
    brokerIntegrationAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    request: {
      symbol,
      side,
      qty,
      notional,
      orderType,
      timeInForce,
      limitPrice,
      stopPrice,
      auditId
    },
    preview: {
      previewStatus: 'blocked',
      wouldContactBroker: false,
      wouldPlaceOrder: false,
      wouldMutateAccount: false,
      blocked: true,
      blockReasons
    },
    ts: new Date(nowMs).toISOString()
  };
}

export function getPaperBrokerNullAdapterDiagnostics(options = {}) {
  return previewPaperBrokerNullOrder({
    symbol: options.symbol ?? 'AAPL',
    side: options.side ?? 'buy',
    qty: options.qty ?? 1,
    notional: options.notional,
    orderType: options.orderType ?? 'market',
    timeInForce: options.timeInForce ?? 'day'
  }, options);
}

export default {
  PAPER_BROKER_NULL_ADAPTER_VERSION,
  previewPaperBrokerNullOrder,
  getPaperBrokerNullAdapterDiagnostics
};
