import { buildPaperTradeExecutionPayloadPreview } from './paper_trade_execution_payload_preview.mjs';

export const PAPER_TRADE_SIZING_PREVIEW_VERSION =
  'paper_trade_sizing_preview_v1';

const DEFAULT_EQUITY = 10000;
const DEFAULT_RISK_PCT = 0.005;
const DEFAULT_STOP_PCT = 0.02;
const DEFAULT_MAX_NOTIONAL_PCT = 0.1;

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function floorToShares(value) {
  return Math.max(0, Math.floor(value));
}

export function buildPaperTradeSizingPreview(options = {}) {
  const payloadPreview =
    options.payloadPreview || buildPaperTradeExecutionPayloadPreview(options);

  const paperEquity = positiveNumber(
    options.paperEquity ?? process.env.PAPER_TRADE_EQUITY,
    DEFAULT_EQUITY
  );

  const riskPct = positiveNumber(
    options.riskPct ?? process.env.PAPER_TRADE_RISK_PCT,
    DEFAULT_RISK_PCT
  );

  const stopPct = positiveNumber(
    options.stopPct ?? process.env.PAPER_TRADE_STOP_PCT,
    DEFAULT_STOP_PCT
  );

  const maxNotionalPct = positiveNumber(
    options.maxNotionalPct ?? process.env.PAPER_TRADE_MAX_NOTIONAL_PCT,
    DEFAULT_MAX_NOTIONAL_PCT
  );

  const reasons = [...(payloadPreview.reasons || [])];
  const entryPrice = payloadPreview.normalized?.entryPrice;

  if (!payloadPreview.payloadReady) reasons.push('execution_payload_not_ready');
  if (!(entryPrice > 0)) reasons.push('entry_price_missing_for_sizing');

  const riskBudget = paperEquity * riskPct;
  const maxNotional = paperEquity * maxNotionalPct;

  const riskBasedQty =
    entryPrice > 0 ? floorToShares(riskBudget / (entryPrice * stopPct)) : 0;
  const maxNotionalQty =
    entryPrice > 0 ? floorToShares(maxNotional / entryPrice) : 0;

  const quantity = Math.min(riskBasedQty, maxNotionalQty);
  const notional = quantity > 0 && entryPrice > 0 ? Number((quantity * entryPrice).toFixed(2)) : 0;

  if (payloadPreview.payloadReady && quantity <= 0) {
    reasons.push('sizing_quantity_zero');
  }

  const sizingReady = payloadPreview.payloadReady && quantity > 0 && reasons.length === 0;

  return {
    ok: true,
    version: PAPER_TRADE_SIZING_PREVIEW_VERSION,
    monitorOnly: true,
    previewOnly: true,
    status: sizingReady ? 'ready' : 'blocked',
    sizingReady,
    reasonCount: reasons.length,
    reasons,
    payloadPreviewVersion: payloadPreview.version,
    sourceIntentId: payloadPreview.sourceIntentId,
    normalized: {
      symbol: payloadPreview.normalized?.symbol || '',
      side: payloadPreview.normalized?.side || null,
      entryPrice: entryPrice || null
    },
    sizingModel: {
      model: 'fixed_risk_pct_with_max_notional_cap',
      paperEquity,
      riskPct,
      stopPct,
      maxNotionalPct,
      riskBudget: Number(riskBudget.toFixed(2)),
      maxNotional: Number(maxNotional.toFixed(2)),
      riskBasedQty,
      maxNotionalQty,
      quantity,
      notional
    },
    sizedExecutionPayload:
      sizingReady && payloadPreview.executionPayload
        ? {
            ...payloadPreview.executionPayload,
            quantity,
            notional,
            sizingModel: 'fixed_risk_pct_with_max_notional_cap',
            paperEquity,
            riskPct,
            stopPct,
            maxNotionalPct
          }
        : null,
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

export function buildPaperTradeSizingPreviewPanel(options = {}) {
  const preview = buildPaperTradeSizingPreview(options);

  return {
    ok: true,
    version: 'paper_trade_sizing_preview_panel_v1',
    sizingVersion: preview.version,
    monitorOnly: true,
    previewOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Sizing Preview',
    route: '/diagnostics/paper-trade-sizing-preview',
    refreshRoute: '/diagnostics/paper-trade-sizing-preview-panel',
    status: preview.status,
    severity: preview.status === 'ready' ? 'info' : 'blocked',
    sizingReady: preview.sizingReady,
    reasonCount: preview.reasonCount,
    reasons: preview.reasons,
    summary: {
      sourceIntentId: preview.sourceIntentId,
      symbol: preview.normalized.symbol || null,
      side: preview.normalized.side,
      entryPrice: preview.normalized.entryPrice,
      quantity: preview.sizingModel.quantity,
      notional: preview.sizingModel.notional,
      paperEquity: preview.sizingModel.paperEquity,
      riskPct: preview.sizingModel.riskPct,
      stopPct: preview.sizingModel.stopPct,
      maxNotionalPct: preview.sizingModel.maxNotionalPct
    },
    badges: [
      { label: 'Preview Only', value: true },
      { label: 'Monitor Only', value: true },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: preview.safety
  };
}
