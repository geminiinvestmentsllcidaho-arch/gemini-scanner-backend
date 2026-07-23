import { readPaperTradeLifecycleRunnerAuditDashboard } from './paper_trade_lifecycle_runner_audit.mjs';

export const PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_PANEL_VERSION =
  'paper_trade_lifecycle_runner_audit_panel_v1';

export function readPaperTradeLifecycleRunnerAuditPanel(options = {}) {
  const dashboard = readPaperTradeLifecycleRunnerAuditDashboard(options);
  const latest = dashboard.latestRecord;

  return {
    ok: true,
    version: PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_PANEL_VERSION,
    auditVersion: dashboard.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Lifecycle Runner Audit',
    route: '/diagnostics/paper-trade-lifecycle-runner-audit',
    refreshRoute: '/diagnostics/paper-trade-lifecycle-runner-audit-panel',
    status: dashboard.latestStatus,
    severity:
      dashboard.latestStatus === 'complete_local_simulation' ||
      dashboard.latestStatus === 'idempotent_replay_noop'
        ? 'info'
        : dashboard.latestStatus === 'recovered_partial_local_simulation'
          ? 'warning'
          : dashboard.latestStatus === 'blocked_or_partial'
            ? 'blocked'
            : 'neutral',
    recordCount: dashboard.recordCount,
    hasRecords: dashboard.hasRecords,
    summary: {
      latestStatus: dashboard.latestStatus,
      lifecycleComplete: latest?.lifecycleComplete ?? false,
      lifecycleRecovered: latest?.lifecycleRecovered ?? false,
      lifecycleReplayNoop: latest?.lifecycleReplayNoop ?? false,
      resumedFromIntent: latest?.recovery?.resumedFromIntent ?? false,
      resumedFromTicket: latest?.recovery?.resumedFromTicket ?? false,
      resumedFromFill: latest?.recovery?.resumedFromFill ?? false,
      positionAlreadyStored: latest?.recovery?.positionAlreadyStored ?? false,
      intentCreated: latest?.intentCreated ?? false,
      ticketStored: latest?.ticketStored ?? false,
      fillStored: latest?.fillStored ?? false,
      positionStored: latest?.positionStored ?? false,
      wroteAnyRecord: latest?.wroteAnyRecord ?? false,
      latestIntentId: latest?.latestIds?.intentId || null,
      latestTicketId: latest?.latestIds?.ticketId || null,
      latestFillId: latest?.latestIds?.fillId || null,
      latestPositionSnapshotId: latest?.latestIds?.positionSnapshotId || null,
      openPositionCount: latest?.positionSummary?.openPositionCount ?? 0,
      totalCostBasis: latest?.positionSummary?.totalCostBasis ?? 0,
      totalRealizedPnl: latest?.positionSummary?.totalRealizedPnl ?? 0
    },
    metrics: {
      recordCount: dashboard.recordCount,
      latestLifecycleComplete: latest?.lifecycleComplete ?? false,
      latestLifecycleRecovered: latest?.lifecycleRecovered ?? false,
      latestLifecycleReplayNoop: latest?.lifecycleReplayNoop ?? false,
      latestWroteAnyRecord: latest?.wroteAnyRecord ?? false,
      openPositionCount: latest?.positionSummary?.openPositionCount ?? 0,
      totalCostBasis: latest?.positionSummary?.totalCostBasis ?? 0,
      totalRealizedPnl: latest?.positionSummary?.totalRealizedPnl ?? 0
    },
    badges: [
      { label: 'Monitor Only', value: true },
      { label: 'Local JSONL Only', value: true },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: dashboard.safety
  };
}
