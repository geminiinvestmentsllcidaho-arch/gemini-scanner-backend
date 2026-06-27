import fs from "node:fs";
import {
  getDefaultPaperTradeIntentAuditPath,
  getPaperTradeIntentAuditSummary,
  recordPaperTradeIntentSnapshot,
} from "../src/scanner/paper_trade_intent_audit_store.mjs";

const DASHBOARD_URL = process.env.PAPER_TRADE_INTENT_DASHBOARD_URL || "http://127.0.0.1:3000/diagnostics/paper-trade-intent-dashboard-panel";
const auditPath = process.env.PAPER_TRADE_INTENT_AUDIT_PATH || getDefaultPaperTradeIntentAuditPath();

async function fetchDashboardSnapshot() {
  try {
    const response = await fetch(DASHBOARD_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2500),
    });

    const text = await response.text();

    try {
      return {
        ok: response.ok,
        httpStatus: response.status,
        url: DASHBOARD_URL,
        body: JSON.parse(text),
      };
    } catch {
      return {
        ok: response.ok,
        httpStatus: response.status,
        url: DASHBOARD_URL,
        body: { raw: text.slice(0, 1000) },
      };
    }
  } catch (error) {
    return {
      ok: false,
      url: DASHBOARD_URL,
      error: error?.message || String(error),
    };
  }
}

function readPlannerSnapshot() {
  const candidates = [
    "runs/paper_trade_intent_plan.json",
    "runs/paper_trade_intent_planner.json",
    "runs/paper_trade_intent_dashboard_panel.json",
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    try {
      return {
        ok: true,
        sourcePath: candidate,
        body: JSON.parse(fs.readFileSync(candidate, "utf8")),
      };
    } catch (error) {
      return {
        ok: false,
        sourcePath: candidate,
        error: error?.message || String(error),
      };
    }
  }

  return {
    ok: false,
    sourcePath: null,
    error: "planner_snapshot_file_not_found",
  };
}

const dashboardSnapshot = await fetchDashboardSnapshot();
const plannerSnapshot = readPlannerSnapshot();

const dashboardBody = dashboardSnapshot?.body || {};
const plannerBody = plannerSnapshot?.body || {};

const result = recordPaperTradeIntentSnapshot({
  source: "audit_paper_trade_intent_script",
  plannerSnapshot,
  dashboardSnapshot,
  status:
    dashboardBody?.paperTradeIntentStatus ||
    dashboardBody?.readinessGateStatus ||
    plannerBody?.paperTradeIntentStatus ||
    plannerBody?.readinessGateStatus ||
    "unknown",
  reasons:
    dashboardBody?.blockReasons ||
    dashboardBody?.reasons ||
    plannerBody?.blockReasons ||
    plannerBody?.reasons ||
    [],
  meta: {
    dashboardUrl: DASHBOARD_URL,
    note: "monitor_only_local_audit_snapshot",
  },
  auditPath,
});

const summary = getPaperTradeIntentAuditSummary({ auditPath, limit: 5 });

console.log(JSON.stringify({
  ok: true,
  version: result.version,
  monitorOnly: true,
  auditPath,
  appended: true,
  summary,
}, null, 2));
