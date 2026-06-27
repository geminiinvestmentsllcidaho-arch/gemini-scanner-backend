import {
  DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH,
  readPaperTradeIntentCreationRecords
} from './paper_trade_intent_creation_store.mjs';

export const PAPER_TRADE_EXECUTION_PAYLOAD_PREVIEW_VERSION =
  'paper_trade_execution_payload_preview_v1';

function latestRecord(records) {
  return records.length ? records[records.length - 1] : null;
}

function normalizeSide(action) {
  return action === 'buy' || action === 'sell' ? action : null;
}

export function buildPaperTradeExecutionPayloadPreview(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH;

  const records =
    options.records || readPaperTradeIntentCreationRecords(ledgerPath);

  const intent = options.intent || latestRecord(records);
  const side = normalizeSide(intent?.action);

  const reasons = [];

  if (!intent) reasons.push('paper_intent_missing');
  if (intent && !intent.symbol) reasons.push('paper_intent_symbol_missing');
  if (intent && !side) reasons.push('paper_intent_action_not_tradeable');
  if (intent && !(Number(intent.entryPrice) > 0)) {
    reasons.push('paper_intent_entry_price_missing');
  }

  const payloadReady = reasons.length === 0;

  return {
    ok: true,
    version: PAPER_TRADE_EXECUTION_PAYLOAD_PREVIEW_VERSION,
    monitorOnly: true,
    previewOnly: true,
    status: payloadReady ? 'ready' : 'blocked',
    payloadReady,
    reasonCount: reasons.length,
    reasons,
    sourceLedgerPath: ledgerPath,
    sourceRecordCount: records.length,
    sourceIntentId: intent?.intentId || null,
    sourceIntentCreatedAt: intent?.createdAt || null,
    normalized: {
      symbol: intent?.symbol || '',
      side,
      entryPrice: Number(intent?.entryPrice) > 0 ? Number(intent.entryPrice) : null
    },
    executionPayload: payloadReady
      ? {
          symbol: intent.symbol,
          side,
          orderType: 'market',
          timeInForce: 'day',
          notional: null,
          quantity: null,
          entryReferencePrice: Number(intent.entryPrice),
          executionAdapter: 'none',
          broker: 'none',
          previewOnly: true,
          paperOnly: true
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

export function buildPaperTradeExecutionPayloadPreviewPanel(options = {}) {
  const preview = buildPaperTradeExecutionPayloadPreview(options);

  return {
    ok: true,
    version: 'paper_trade_execution_payload_preview_panel_v1',
    previewVersion: preview.version,
    monitorOnly: true,
    previewOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Execution Payload Preview',
    route: '/diagnostics/paper-trade-execution-payload-preview',
    refreshRoute: '/diagnostics/paper-trade-execution-payload-preview-panel',
    status: preview.status,
    severity: preview.status === 'ready' ? 'info' : 'blocked',
    payloadReady: preview.payloadReady,
    reasonCount: preview.reasonCount,
    reasons: preview.reasons,
    summary: {
      sourceIntentId: preview.sourceIntentId,
      symbol: preview.normalized.symbol || null,
      side: preview.normalized.side,
      entryPrice: preview.normalized.entryPrice,
      orderType: preview.executionPayload?.orderType || null,
      timeInForce: preview.executionPayload?.timeInForce || null,
      executionAdapter: preview.executionPayload?.executionAdapter || 'none',
      broker: preview.executionPayload?.broker || 'none'
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
