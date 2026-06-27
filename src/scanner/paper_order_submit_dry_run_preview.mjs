import {
  normalizePaperBrokerOrderRequest,
  validatePaperBrokerOrderRequest
} from './paper_broker_adapter_contract.mjs';

import {
  buildAlpacaPaperOrderPayload,
  previewAlpacaPaperBrokerOrder
} from './alpaca_paper_broker_adapter.mjs';

export const PAPER_ORDER_SUBMIT_DRY_RUN_PREVIEW_VERSION = 'paper_order_submit_dry_run_preview_v1';

function cleanLower(value) {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values = []) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))];
}

export async function buildPaperOrderSubmitDryRunPreview(input = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const request = normalizePaperBrokerOrderRequest(input, { nowMs });
  const validation = validatePaperBrokerOrderRequest(request);
  const adapter = await previewAlpacaPaperBrokerOrder(request, options);
  const marketSession = cleanLower(options.marketSession ?? input.marketSession ?? 'unknown');

  const blockReasons = unique([
    'paper_order_submit_dry_run_only',
    'order_not_sent',
    marketSession === 'regular' ? '' : 'market_session_not_regular',
    ...validation.blockReasons,
    ...adapter.preview.blockReasons
  ]);

  return {
    ok: true,
    version: PAPER_ORDER_SUBMIT_DRY_RUN_PREVIEW_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    dryRun: true,
    submitAttempted: false,
    brokerContactAttempted: false,
    brokerContactAllowed: adapter.brokerContactAllowed,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    marketSession,
    request,
    alpacaPayloadPreview: buildAlpacaPaperOrderPayload(request, { nowMs }),
    validation: {
      ok: validation.ok,
      blockReasons: validation.blockReasons
    },
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

export async function getPaperOrderSubmitDryRunDiagnostics(options = {}) {
  return buildPaperOrderSubmitDryRunPreview({
    symbol: options.symbol ?? 'AAPL',
    side: options.side ?? 'buy',
    qty: options.qty ?? 1,
    orderType: options.orderType ?? 'market',
    timeInForce: options.timeInForce ?? 'day',
    marketSession: options.marketSession
  }, options);
}

export default {
  PAPER_ORDER_SUBMIT_DRY_RUN_PREVIEW_VERSION,
  buildPaperOrderSubmitDryRunPreview,
  getPaperOrderSubmitDryRunDiagnostics
};
