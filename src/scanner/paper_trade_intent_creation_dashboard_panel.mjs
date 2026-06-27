import { readPaperTradeIntentCreationDashboard } from './paper_trade_intent_creation_dashboard.mjs';

export const PAPER_TRADE_INTENT_CREATION_DASHBOARD_PANEL_VERSION =
  'paper_trade_intent_creation_dashboard_panel_v1';

export function readPaperTradeIntentCreationDashboardPanel(options = {}) {
  const dashboard = readPaperTradeIntentCreationDashboard(options);
  const latest = dashboard.latestRecord;

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_DASHBOARD_PANEL_VERSION,
    dashboardVersion: dashboard.version,
    monitorOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Intent Creation Store',
    status: dashboard.latestStatus,
    severity: dashboard.latestStatus === 'created' ? 'info' : 'neutral',
    route: '/diagnostics/paper-trade-intent-creation-store',
    refreshRoute: '/diagnostics/paper-trade-intent-creation-store-panel',
    recordCount: dashboard.recordCount,
    hasRecords: dashboard.hasRecords,
    summary: {
      latestStatus: dashboard.latestStatus,
      latestIntentId: latest?.intentId || null,
      latestSymbol: latest?.symbol || null,
      latestAction: latest?.action || null,
      latestEntryPrice: latest?.entryPrice || null,
      latestCreatedAt: latest?.createdAt || null
    },
    badges: [
      { label: 'Monitor Only', value: true },
      { label: 'Local JSONL Only', value: true },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    metrics: {
      recordCount: dashboard.recordCount,
      latestStatus: dashboard.latestStatus,
      latestSymbol: latest?.symbol || null,
      latestAction: latest?.action || null,
      latestEntryPrice: latest?.entryPrice || null
    },
    safety: dashboard.safety
  };
}
