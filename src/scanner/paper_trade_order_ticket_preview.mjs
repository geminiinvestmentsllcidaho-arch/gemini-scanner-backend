import { buildPaperTradeSizingPreview } from './paper_trade_sizing_preview.mjs';

export const PAPER_TRADE_ORDER_TICKET_PREVIEW_VERSION =
  'paper_trade_order_ticket_preview_v1';

function validSide(side) {
  return side === 'buy' || side === 'sell';
}

function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0;
}

export function buildPaperTradeOrderTicketPreview(options = {}) {
  const sizingPreview =
    options.sizingPreview || buildPaperTradeSizingPreview(options);

  const sizedPayload = sizingPreview.sizedExecutionPayload;
  const reasons = [...(sizingPreview.reasons || [])];

  if (!sizingPreview.sizingReady) reasons.push('paper_trade_sizing_not_ready');
  if (!sizedPayload) reasons.push('sized_execution_payload_missing');
  if (sizedPayload && !sizedPayload.symbol) reasons.push('ticket_symbol_missing');
  if (sizedPayload && !validSide(sizedPayload.side)) reasons.push('ticket_side_invalid');
  if (sizedPayload && !positiveInteger(sizedPayload.quantity)) reasons.push('ticket_quantity_invalid');
  if (sizedPayload && sizedPayload.orderType !== 'market') reasons.push('ticket_order_type_invalid');
  if (sizedPayload && sizedPayload.timeInForce !== 'day') reasons.push('ticket_time_in_force_invalid');

  const ticketReady = Boolean(
    sizingPreview.sizingReady &&
      sizedPayload &&
      sizedPayload.symbol &&
      validSide(sizedPayload.side) &&
      positiveInteger(sizedPayload.quantity) &&
      sizedPayload.orderType === 'market' &&
      sizedPayload.timeInForce === 'day' &&
      reasons.length === 0
  );

  return {
    ok: true,
    version: PAPER_TRADE_ORDER_TICKET_PREVIEW_VERSION,
    monitorOnly: true,
    previewOnly: true,
    status: ticketReady ? 'ready' : 'blocked',
    ticketReady,
    reasonCount: reasons.length,
    reasons,
    sizingPreviewVersion: sizingPreview.version,
    sourceIntentId: sizingPreview.sourceIntentId,
    normalized: {
      symbol: sizedPayload?.symbol || sizingPreview.normalized?.symbol || '',
      side: sizedPayload?.side || sizingPreview.normalized?.side || null,
      quantity: sizedPayload?.quantity || sizingPreview.sizingModel?.quantity || 0,
      notional: sizedPayload?.notional || sizingPreview.sizingModel?.notional || 0,
      entryReferencePrice:
        sizedPayload?.entryReferencePrice ||
        sizingPreview.normalized?.entryPrice ||
        null
    },
    orderTicket: ticketReady
      ? {
          symbol: sizedPayload.symbol,
          side: sizedPayload.side,
          type: 'market',
          qty: String(sizedPayload.quantity),
          time_in_force: 'day',
          client_order_id: null,
          extended_hours: false,
          order_class: 'simple',
          sourceIntentId: sizingPreview.sourceIntentId,
          previewOnly: true,
          paperOnly: true,
          executionAdapter: 'none',
          broker: 'none'
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

export function buildPaperTradeOrderTicketPreviewPanel(options = {}) {
  const preview = buildPaperTradeOrderTicketPreview(options);

  return {
    ok: true,
    version: 'paper_trade_order_ticket_preview_panel_v1',
    ticketPreviewVersion: preview.version,
    monitorOnly: true,
    previewOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Order Ticket Preview',
    route: '/diagnostics/paper-trade-order-ticket-preview',
    refreshRoute: '/diagnostics/paper-trade-order-ticket-preview-panel',
    status: preview.status,
    severity: preview.status === 'ready' ? 'info' : 'blocked',
    ticketReady: preview.ticketReady,
    reasonCount: preview.reasonCount,
    reasons: preview.reasons,
    summary: {
      sourceIntentId: preview.sourceIntentId,
      symbol: preview.normalized.symbol || null,
      side: preview.normalized.side,
      quantity: preview.normalized.quantity,
      notional: preview.normalized.notional,
      entryReferencePrice: preview.normalized.entryReferencePrice,
      orderType: preview.orderTicket?.type || null,
      timeInForce: preview.orderTicket?.time_in_force || null,
      executionAdapter: preview.orderTicket?.executionAdapter || 'none',
      broker: preview.orderTicket?.broker || 'none'
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
