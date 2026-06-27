import { readPaperTradeOrderTicketStoreDashboard } from './paper_trade_order_ticket_store.mjs';

export const PAPER_TRADE_ORDER_TICKET_STORE_PANEL_VERSION =
  'paper_trade_order_ticket_store_panel_v1';

export function readPaperTradeOrderTicketStorePanel(options = {}) {
  const dashboard = readPaperTradeOrderTicketStoreDashboard(options);
  const latest = dashboard.latestRecord;

  return {
    ok: true,
    version: PAPER_TRADE_ORDER_TICKET_STORE_PANEL_VERSION,
    storeVersion: dashboard.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Order Ticket Store',
    route: '/diagnostics/paper-trade-order-ticket-store',
    refreshRoute: '/diagnostics/paper-trade-order-ticket-store-panel',
    status: dashboard.latestStatus,
    severity: dashboard.latestStatus === 'stored' ? 'info' : 'neutral',
    recordCount: dashboard.recordCount,
    hasRecords: dashboard.hasRecords,
    summary: {
      latestStatus: dashboard.latestStatus,
      latestTicketId: latest?.ticketId || null,
      latestSourceIntentId: latest?.sourceIntentId || null,
      latestSymbol: latest?.symbol || null,
      latestSide: latest?.side || null,
      latestType: latest?.type || null,
      latestQty: latest?.qty || null,
      latestTimeInForce: latest?.time_in_force || null,
      latestCreatedAt: latest?.createdAt || null,
      executionAdapter: latest?.executionAdapter || 'none',
      broker: latest?.broker || 'none'
    },
    metrics: {
      recordCount: dashboard.recordCount,
      latestStatus: dashboard.latestStatus,
      latestSymbol: latest?.symbol || null,
      latestSide: latest?.side || null,
      latestQty: latest?.qty || null
    },
    badges: [
      { label: 'Preview Only', value: true },
      { label: 'Monitor Only', value: true },
      { label: 'Local JSONL Only', value: true },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: dashboard.safety
  };
}
