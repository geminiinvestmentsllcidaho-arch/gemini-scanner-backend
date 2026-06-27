import { readPaperTradeIntentCreationRunnerAuditDashboard } from './paper_trade_intent_creation_runner_audit.mjs';

export const PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_PANEL_VERSION =
  'paper_trade_intent_creation_runner_audit_panel_v1';

export function readPaperTradeIntentCreationRunnerAuditPanel(options = {}) {
  const dashboard = readPaperTradeIntentCreationRunnerAuditDashboard(options);
  const latest = dashboard.latestRecord;

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_RUNNER_AUDIT_PANEL_VERSION,
    auditVersion: dashboard.version,
    monitorOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Intent Creation Runner Audit',
    route: '/diagnostics/paper-trade-intent-creation-runner-audit',
    refreshRoute: '/diagnostics/paper-trade-intent-creation-runner-audit-panel',
    status: dashboard.latestStatus,
    severity:
      dashboard.latestStatus === 'created'
        ? 'info'
        : dashboard.latestStatus === 'blocked'
          ? 'blocked'
          : 'neutral',
    recordCount: dashboard.recordCount,
    hasRecords: dashboard.hasRecords,
    summary: {
      latestStatus: dashboard.latestStatus,
      latestCreatedIntentId: latest?.createdIntentId || null,
      latestIntentWouldBeCreated: latest?.intentWouldBeCreated ?? false,
      latestIntentCreated: latest?.intentCreated ?? false,
      latestWroteRecord: latest?.wroteRecord ?? false,
      latestSymbol: latest?.normalized?.symbol || null,
      latestAction: latest?.normalized?.action || null,
      latestEntryPrice: latest?.normalized?.entryPrice ?? null,
      latestReasons: latest?.creationReasons || []
    },
    metrics: {
      recordCount: dashboard.recordCount,
      latestStatus: dashboard.latestStatus,
      latestIntentCreated: latest?.intentCreated ?? false,
      latestWroteRecord: latest?.wroteRecord ?? false
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
