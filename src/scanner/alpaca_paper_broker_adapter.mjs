import {
  PAPER_BROKER_ADAPTER_CONTRACT_VERSION,
  normalizePaperBrokerOrderRequest,
  validatePaperBrokerOrderRequest
} from './paper_broker_adapter_contract.mjs';

import {
  evaluatePaperBrokerAdapterApproval
} from './paper_broker_adapter_approval_record_tool.mjs';

export const ALPACA_PAPER_BROKER_ADAPTER_VERSION = 'alpaca_paper_broker_adapter_v1';

function unique(values = []) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))];
}

export function buildAlpacaPaperOrderPayload(request = {}, options = {}) {
  const normalized = normalizePaperBrokerOrderRequest(request, options);

  const payload = {
    symbol: normalized.symbol,
    side: normalized.side,
    type: normalized.orderType,
    time_in_force: normalized.timeInForce
  };

  if (normalized.qty !== null) payload.qty = String(normalized.qty);
  if (normalized.notional !== null) payload.notional = String(normalized.notional);
  if (normalized.limitPrice !== null) payload.limit_price = String(normalized.limitPrice);
  if (normalized.stopPrice !== null) payload.stop_price = String(normalized.stopPrice);

  return payload;
}

export async function previewAlpacaPaperBrokerOrder(request = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const normalized = normalizePaperBrokerOrderRequest(request, { nowMs });
  const validation = validatePaperBrokerOrderRequest(normalized);
  const approval = await evaluatePaperBrokerAdapterApproval(options);
  const payload = buildAlpacaPaperOrderPayload(normalized, { nowMs });

  const blockReasons = unique([
    'alpaca_paper_adapter_preview_only',
    'broker_contact_not_performed',
    'order_submit_not_enabled',
    ...validation.blockReasons,
    ...approval.lockReasons
  ]);

  return {
    ok: true,
    version: ALPACA_PAPER_BROKER_ADAPTER_VERSION,
    contractVersion: PAPER_BROKER_ADAPTER_CONTRACT_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    adapterKind: 'alpaca-paper',
    adapterEnabled: approval.approvalLockPassed,
    approvalLockPassed: approval.approvalLockPassed,
    brokerContactAllowed: approval.brokerContactAllowed,
    brokerIntegrationAllowed: approval.brokerIntegrationAllowed,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    request: normalized,
    alpacaPayloadPreview: payload,
    preview: {
      previewStatus: 'blocked',
      blocked: true,
      wouldContactBroker: false,
      wouldPlaceOrder: false,
      wouldMutateAccount: false,
      blockReasons
    },
    ts: new Date(nowMs).toISOString()
  };
}

export async function submitAlpacaPaperBrokerOrder(request = {}, options = {}) {
  const preview = await previewAlpacaPaperBrokerOrder(request, options);

  return {
    ...preview,
    submit: {
      submitAttempted: false,
      submitStatus: 'blocked',
      orderId: null,
      brokerResponse: null,
      blockReasons: unique([
        'submit_function_locked',
        'manual_first_order_gate_required',
        ...preview.preview.blockReasons
      ])
    }
  };
}

export async function getAlpacaPaperBrokerAdapterDiagnostics(options = {}) {
  return previewAlpacaPaperBrokerOrder({
    symbol: options.symbol ?? 'AAPL',
    side: options.side ?? 'buy',
    qty: options.qty ?? 1,
    orderType: options.orderType ?? 'market',
    timeInForce: options.timeInForce ?? 'day'
  }, options);
}

export default {
  ALPACA_PAPER_BROKER_ADAPTER_VERSION,
  buildAlpacaPaperOrderPayload,
  previewAlpacaPaperBrokerOrder,
  submitAlpacaPaperBrokerOrder,
  getAlpacaPaperBrokerAdapterDiagnostics
};
