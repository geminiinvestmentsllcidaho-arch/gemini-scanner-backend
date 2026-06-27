import * as panelFs from "node:fs";
import * as panelPath from "node:path";
import buildPaperTradeIntentAuditDashboard from "./paper_trade_intent_audit_dashboard.mjs";

const PAPER_TRADE_INTENT_AUDIT_LEDGER_PATH = panelPath.resolve(process.cwd(), "runs", "paper_trade_intent_audit_store.jsonl");

function countPaperTradeIntentAuditLedgerRecords(filePath = PAPER_TRADE_INTENT_AUDIT_LEDGER_PATH) {
  try {
    if (!panelFs.existsSync(filePath)) return 0;
    const raw = panelFs.readFileSync(filePath, "utf8").trim();
    if (!raw) return 0;
    return raw.split(/\r?\n/).filter(Boolean).length;
  } catch {
    return 0;
  }
}


export async function getPaperTradeIntentAuditDashboardPanel() {
  const dashboard = await buildPaperTradeIntentAuditDashboard();
  const ledgerRecordCount = countPaperTradeIntentAuditLedgerRecords();
  const effectiveRecordCount = Number(dashboard.recordCount || 0) || ledgerRecordCount;

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
