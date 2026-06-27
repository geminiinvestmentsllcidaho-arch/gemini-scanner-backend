import buildPaperTradeIntentAuditDashboard from "./paper_trade_intent_audit_dashboard.mjs";

export async function getPaperTradeIntentAuditDashboardPanel() {
  const dashboard = await buildPaperTradeIntentAuditDashboard();
  const effectiveRecordCount = Number(dashboard.recordCount ?? 0);

  const latestStatus = String(dashboard.latestStatus || "unknown");
  const latestReasons = Array.isArray(dashboard.latestReasons)
    ? dashboard.latestReasons.map(String)
    : [];

  return {
    ok: true,
    version: "paper_trade_intent_audit_dashboard_panel_v1",
    monitorOnly: true,
    panelType: "operator_dashboard_card",
    title: "Paper Trade Intent Audit",
    latestStatus,
    latestReasons,
    recordCount: Number(effectiveRecordCount || 0),
    safetyFlags: {
      noOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noBrokerExecution: true,
      noAccountMutation: true,
      noBrokerContact: true,
      localJsonlReadOnly: true
    },
    card: {
      statusLabel: latestStatus.toUpperCase(),
      reasonCount: latestReasons.length,
      reasonText: latestReasons.length ? latestReasons.join(", ") : "none",
      recordCountText: String(effectiveRecordCount || 0),
      severity:
        latestStatus === "blocked" ? "warning" :
        latestStatus === "ready" ? "success" :
        "neutral"
    },
    source: {
      route: "/diagnostics/paper-trade-intent-audit-dashboard",
      version: dashboard.version || null
    },
    dashboard
  };
}

export default getPaperTradeIntentAuditDashboardPanel;
