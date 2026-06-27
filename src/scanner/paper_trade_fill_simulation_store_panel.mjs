import { readPaperTradeFillSimulationStoreDashboard } from './paper_trade_fill_simulation_store.mjs';

export const PAPER_TRADE_FILL_SIMULATION_STORE_PANEL_VERSION =
  'paper_trade_fill_simulation_store_panel_v1';

export function readPaperTradeFillSimulationStorePanel(options = {}) {
  const dashboard = readPaperTradeFillSimulationStoreDashboard(options);
  const latest = dashboard.latestRecord;

  return {
    ok: true,
    version: PAPER_TRADE_FILL_SIMULATION_STORE_PANEL_VERSION,
    storeVersion: dashboard.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Fill Simulation Store',
    route: '/diagnostics/paper-trade-fill-simulation-store',
    refreshRoute: '/diagnostics/paper-trade-fill-simulation-store-panel',
    status: dashboard.latestStatus,
    severity: dashboard.latestStatus === 'stored' ? 'info' : 'neutral',
    recordCount: dashboard.recordCount,
    hasRecords: dashboard.hasRecords,
    summary: {
      latestStatus: dashboard.latestStatus,
      latestFillId: latest?.fillId || null,
      latestSourceTicketId: latest?.sourceTicketId || null,
      latestSourceIntentId: latest?.sourceIntentId || null,
      latestSymbol: latest?.symbol || null,
      latestSide: latest?.side || null,
      latestQty: latest?.qty ?? null,
      latestFillPrice: latest?.fillPrice ?? null,
      latestFilledNotional: latest?.filledNotional ?? null,
      latestFillStatus: latest?.fillStatus || null,
      latestFillType: latest?.fillType || null,
      latestCreatedAt: latest?.createdAt || null,
      executionAdapter: latest?.executionAdapter || 'none',
      broker: latest?.broker || 'none'
    },
    metrics: {
      recordCount: dashboard.recordCount,
      latestStatus: dashboard.latestStatus,
      latestSymbol: latest?.symbol || null,
      latestSide: latest?.side || null,
      latestQty: latest?.qty ?? null,
      latestFilledNotional: latest?.filledNotional ?? null
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
