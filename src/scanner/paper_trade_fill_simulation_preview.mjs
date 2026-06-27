import {
  DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH,
  readPaperTradeOrderTicketRecords
} from './paper_trade_order_ticket_store.mjs';

export const PAPER_TRADE_FILL_SIMULATION_PREVIEW_VERSION =
  'paper_trade_fill_simulation_preview_v1';

function latestRecord(records) {
  return records.length ? records[records.length - 1] : null;
}

function positiveQty(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeSide(side) {
  return side === 'buy' || side === 'sell' ? side : null;
}

export function buildPaperTradeFillSimulationPreview(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_ORDER_TICKET_LEDGER_PATH;

  const records =
    options.records || readPaperTradeOrderTicketRecords(ledgerPath);

  const ticket = options.ticket || latestRecord(records);
  const side = normalizeSide(ticket?.side);
  const qty = positiveQty(ticket?.qty);

  const fillPrice =
    Number(options.fillPrice) > 0
      ? Number(options.fillPrice)
      : Number(options.referencePrice || options.entryReferencePrice || 0) > 0
        ? Number(options.referencePrice || options.entryReferencePrice)
        : null;

  const reasons = [];

  if (!ticket) reasons.push('paper_order_ticket_missing');
  if (ticket && !ticket.ticketId) reasons.push('paper_order_ticket_id_missing');
  if (ticket && !ticket.symbol) reasons.push('paper_order_ticket_symbol_missing');
  if (ticket && !side) reasons.push('paper_order_ticket_side_invalid');
  if (ticket && !qty) reasons.push('paper_order_ticket_quantity_invalid');
  if (ticket && !fillPrice) reasons.push('fill_reference_price_missing');

  const fillReady = reasons.length === 0;

  return {
    ok: true,
    version: PAPER_TRADE_FILL_SIMULATION_PREVIEW_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: fillReady ? 'ready' : 'blocked',
    fillReady,
    reasonCount: reasons.length,
    reasons,
    sourceLedgerPath: ledgerPath,
    sourceRecordCount: records.length,
    sourceTicketId: ticket?.ticketId || null,
    sourceIntentId: ticket?.sourceIntentId || null,
    normalized: {
      symbol: ticket?.symbol || '',
      side,
      qty,
      fillPrice
    },
    simulatedFill: fillReady
      ? {
          sourceTicketId: ticket.ticketId,
          sourceIntentId: ticket.sourceIntentId || null,
          symbol: ticket.symbol,
          side,
          qty,
          fillPrice,
          filledNotional: Number((qty * fillPrice).toFixed(2)),
          fillStatus: 'filled',
          fillType: 'local_simulated_market_fill',
          broker: 'none',
          executionAdapter: 'none',
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

export function buildPaperTradeFillSimulationPreviewPanel(options = {}) {
  const preview = buildPaperTradeFillSimulationPreview(options);

  return {
    ok: true,
    version: 'paper_trade_fill_simulation_preview_panel_v1',
    fillPreviewVersion: preview.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Fill Simulation Preview',
    route: '/diagnostics/paper-trade-fill-simulation-preview',
    refreshRoute: '/diagnostics/paper-trade-fill-simulation-preview-panel',
    status: preview.status,
    severity: preview.status === 'ready' ? 'info' : 'blocked',
    fillReady: preview.fillReady,
    reasonCount: preview.reasonCount,
    reasons: preview.reasons,
    summary: {
      sourceTicketId: preview.sourceTicketId,
      sourceIntentId: preview.sourceIntentId,
      symbol: preview.normalized.symbol || null,
      side: preview.normalized.side,
      qty: preview.normalized.qty,
      fillPrice: preview.normalized.fillPrice,
      filledNotional: preview.simulatedFill?.filledNotional || null,
      fillStatus: preview.simulatedFill?.fillStatus || null,
      fillType: preview.simulatedFill?.fillType || null,
      executionAdapter: preview.simulatedFill?.executionAdapter || 'none',
      broker: preview.simulatedFill?.broker || 'none'
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
