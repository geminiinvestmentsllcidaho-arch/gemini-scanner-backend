import fs from "node:fs";
import path from "node:path";
import { buildPaperAttemptControlCenter } from "./paper_attempt_control_center.mjs";

const VERSION = "paper_attempt_control_center_panel_v1";

function boolOk(value) {
  return value === false || value === undefined || value === null;
}

function latestReportLabel(report) {
  const files = Array.isArray(report?.latestReports) ? report.latestReports : [];
  if (files.length === 0) return "no_recent_report_files";
  return files[0]?.file || "unknown_report";
}

function buildChecklist(report) {
  const safetyFlags = report?.safetyFlags || {};
  const prior = report?.priorAttemptStatus || {};
  const market = report?.marketHours || {};

  return [
    {
      id: "broker_contact_disabled",
      label: "Broker contact disabled",
      pass: !safetyFlags.brokerContactAllowed
    },
    {
      id: "order_placement_disabled",
      label: "Order placement disabled",
      pass: !safetyFlags.orderPlacementAllowed
    },
    {
      id: "live_trading_disabled",
      label: "Live trading disabled",
      pass: !safetyFlags.liveTradingAllowed
    },
    {
      id: "auto_trading_disabled",
      label: "Auto trading disabled",
      pass: !safetyFlags.autoTradingAllowed
    },
    {
      id: "account_mutation_disabled",
      label: "Account mutation disabled",
      pass: !safetyFlags.accountMutationAllowed
    },
    {
      id: "no_prior_network_attempt",
      label: "No prior network attempt detected",
      pass: !prior.networkAttempted
    },
    {
      id: "no_prior_order_submit_attempt",
      label: "No prior order submit attempt detected",
      pass: !prior.orderSubmitAttempted
    },
    {
      id: "market_not_regular_open",
      label: "Regular market window not open by local time check",
      pass: !market.regularMarketHoursLikelyOpen
    }
  ];
}

function buildPaperAttemptControlCenterPanel({ report = buildPaperAttemptControlCenter(), now = new Date() } = {}) {
  const blockers = Array.isArray(report?.blockers) ? report.blockers : [];
  const checklist = buildChecklist(report);
  const failedChecklist = checklist.filter((item) => !item.pass).map((item) => item.id);
  const clear = blockers.length === 0 && failedChecklist.length === 0;

  return {
    ok: true,
    version: VERSION,
    generatedAt: now.toISOString(),
    monitorOnly: true,
    diagnosticsOnly: true,
    panelType: "operator_paper_attempt_control_center_card",
    sourceVersion: report?.version || null,
    controlCenterStatus: report?.controlCenterStatus || "unknown",
    paperAttemptAllowed: false,
    networkAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    operatorStatus: clear ? "clear_monitor_only" : "blocked_monitor_only",
    operatorHeadline: clear
      ? "Paper attempt control center is clear for monitor-only review."
      : "Paper attempt control center is blocked.",
    operatorMessage: clear
      ? "No control-center blockers were detected, but this panel still does not allow broker contact, order submission, live trading, or account mutation."
      : `Detected ${blockers.length} blocker(s) and ${failedChecklist.length} failed checklist item(s). Keep the system monitor-only.`,
    summary: {
      projectName: report?.project?.name || "GeminiScanner",
      branch: report?.project?.branch || null,
      commit: report?.project?.commit || null,
      latestTag: report?.project?.latestTag || null,
      workingTreeClean: Boolean(report?.project?.workingTreeClean),
      latestReport: latestReportLabel(report),
      approvalStatus: report?.approvalChain?.status || "unknown",
      blockerCount: blockers.length,
      failedChecklistCount: failedChecklist.length,
      marketRegularHoursLikelyOpen: Boolean(report?.marketHours?.regularMarketHoursLikelyOpen)
    },
    safety: {
      noBrokerContact: true,
      noNetworkAttempt: true,
      noOrderAttempt: true,
      noSecretExposure: true,
      noAccountMutation: true,
      paperAttemptAllowed: false
    },
    checklist,
    failedChecklist,
    blockers,
    nextOperatorStep: clear
      ? "Review monitor-only evidence. Do not attempt broker contact or order placement from this panel."
      : "Resolve blockers before any future manual paper attempt review."
  };
}

function buildPaperAttemptControlCenterPanelHtml({ panel = buildPaperAttemptControlCenterPanel() } = {}) {
  const rows = panel.checklist
    .map((item) => `<li><strong>${item.pass ? "PASS" : "BLOCK"}</strong> — ${item.label}</li>`)
    .join("");

  const blockers = panel.blockers.length
    ? panel.blockers.map((x) => `<li>${x}</li>`).join("")
    : "<li>none</li>";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>GeminiScanner Paper Attempt Control Center</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #0b1220; color: #e5edf8; }
    .card { border: 1px solid #334155; border-radius: 14px; padding: 18px; max-width: 980px; background: #111827; }
    .status { font-size: 22px; font-weight: 800; }
    .blocked { color: #fca5a5; }
    .clear { color: #86efac; }
    code { color: #bfdbfe; }
    li { margin: 6px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status ${panel.operatorStatus.includes("blocked") ? "blocked" : "clear"}">${panel.operatorHeadline}</div>
    <p>${panel.operatorMessage}</p>
    <p><strong>Version:</strong> <code>${panel.version}</code></p>
    <p><strong>Branch:</strong> <code>${panel.summary.branch}</code> · <strong>Commit:</strong> <code>${panel.summary.commit}</code></p>
    <p><strong>Paper attempt allowed:</strong> <code>${panel.paperAttemptAllowed}</code></p>
    <h3>Checklist</h3>
    <ul>${rows}</ul>
    <h3>Blockers</h3>
    <ul>${blockers}</ul>
    <p><strong>Next:</strong> ${panel.nextOperatorStep}</p>
  </div>
</body>
</html>
`;
}

function writePanelReport({ cwd = process.cwd(), now = new Date() } = {}) {
  const panel = buildPaperAttemptControlCenterPanel({ now });
  const out = path.join(cwd, "runs", `paper_attempt_control_center_panel_${Date.now()}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(panel, null, 2) + "\n");
  return { panel, out };
}

export {
  VERSION,
  buildPaperAttemptControlCenterPanel,
  buildPaperAttemptControlCenterPanelHtml,
  buildChecklist,
  boolOk,
  writePanelReport
};
