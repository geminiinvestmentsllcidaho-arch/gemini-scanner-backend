import { readPaperTradePositionStateStoreDashboard } from './paper_trade_position_state_store.mjs';

export const PAPER_TRADE_POSITION_STATE_STORE_PANEL_VERSION =
  'paper_trade_position_state_store_panel_v1';

export function readPaperTradePositionStateStorePanel(options = {}) {
  const dashboard = readPaperTradePositionStateStoreDashboard(options);
  const latest = dashboard.latestRecord;

  return {
    ok: true,
    version: PAPER_TRADE_POSITION_STATE_STORE_PANEL_VERSION,
    storeVersion: dashboard.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Position State Store',
    route: '/diagnostics/paper-trade-position-state-store',
    refreshRoute: '/diagnostics/paper-trade-position-state-store-panel',
    status: dashboard.latestStatus,
    severity: dashboard.latestStatus === 'stored' ? 'info' : 'neutral',
    recordCount: dashboard.recordCount,
    hasRecords: dashboard.hasRecords,
    summary: {
      latestStatus: dashboard.latestStatus,
      latestSnapshotId: latest?.snapshotId || null,
      latestPositionStatus: latest?.status || null,
      latestSourceRecordCount: latest?.sourceRecordCount ?? 0,
      latestPositionCount: latest?.positionCount ?? 0,
      latestOpenPositionCount: latest?.openPositionCount ?? 0,
      latestClosedPositionCount: latest?.closedPositionCount ?? 0,
      latestTotalCostBasis: latest?.totalCostBasis ?? 0,
      latestTotalRealizedPnl: latest?.totalRealizedPnl ?? 0,
      latestCreatedAt: latest?.createdAt || null
    },
    metrics: {
      recordCount: dashboard.recordCount,
      latestPositionCount: latest?.positionCount ?? 0,
      latestOpenPositionCount: latest?.openPositionCount ?? 0,
      latestTotalCostBasis: latest?.totalCostBasis ?? 0,
      latestTotalRealizedPnl: latest?.totalRealizedPnl ?? 0
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
