import { execFileSync } from "node:child_process";

const VERSION = "paper_attempt_read_only_operator_summary_panel_v1";
const PANEL_TYPE = "operator_dashboard_card";
const TITLE = "Paper Attempt Read-Only Operator Summary Panel";

function safeExec(cmd, args = []) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function firstLine(value) {
  if (!value || typeof value !== "string") return null;
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] ?? null;
}

function readGitSnapshot() {
  const branch = safeExec("git", ["branch", "--show-current"]);
  const commit = safeExec("git", ["rev-parse", "--short", "HEAD"]);
  const fullCommit = safeExec("git", ["rev-parse", "HEAD"]);
  const headTags = safeExec("git", ["tag", "--points-at", "HEAD"]) ?? "";
  const freezeTag = firstLine(
    headTags
      .split(/\r?\n/)
      .filter((tag) => tag.includes("paper-attempt") && tag.includes("freeze"))
      .sort()
      .reverse()
      .join("\n"),
  ) ?? firstLine(headTags);

  return {
    branch: branch || "unknown",
    commit: commit || "unknown",
    fullCommit: fullCommit || "unknown",
    freezeTag: freezeTag || null,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPaperAttemptReadOnlyOperatorSummaryPanel(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const gitSnapshot = options.gitSnapshot ?? readGitSnapshot();

  const summaryItems = [
    { label: "Module status", value: "complete_frozen_no_go", severity: "info" },
    { label: "Order placement", value: "not_ready_blocked", severity: "blocked" },
    { label: "Broker contact", value: "disabled", severity: "blocked" },
    { label: "Execution controls", value: "absent_by_design", severity: "safe" },
    { label: "Next branch type", value: "read_only_diagnostic_or_planning", severity: "info" },
  ];

  const safety = {
    decisionAssistOnly: true,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    auditOnly: true,
    reviewOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
  };

  return {
    ok: true,
    version: VERSION,
    panelType: PANEL_TYPE,
    title: TITLE,
    generatedAt: now.toISOString(),
    moduleComplete: true,
    status: "read_only_operator_summary_ready",
    severity: "info",
    displayState: "READ_ONLY_SUMMARY_NO_GO",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    noExecutionControls: true,
    sourceModule: "paper_attempt_module_complete_selector_panel_v1",
    currentFreeze: gitSnapshot,
    summaryItems,
    safety,
    issueFlags: [
      "order_placement_not_ready",
      "broker_contact_disabled",
      "execution_controls_absent",
      "read_only_summary_only",
    ],
    operatorMessage:
      "Paper Attempt Module Complete remains frozen in a NO_GO state. This panel is read-only and summarizes the operator-safe status without broker contact, order placement, or account mutation.",
  };
}

export function renderPaperAttemptReadOnlyOperatorSummaryPanelView(
  panel = buildPaperAttemptReadOnlyOperatorSummaryPanel(),
) {
  const rows = panel.summaryItems
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td><code>${escapeHtml(item.value)}</code></td>
          <td>${escapeHtml(item.severity)}</td>
        </tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(panel.title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.45; }
    .card { border: 1px solid #ddd; border-radius: 14px; padding: 1.25rem; max-width: 980px; }
    .state { display: inline-block; padding: .35rem .55rem; border-radius: 999px; background: #f3f4f6; font-weight: 700; }
    code { background: #f6f8fa; padding: .15rem .35rem; border-radius: 6px; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #e5e7eb; padding: .65rem; text-align: left; }
    th { background: #f9fafb; }
  </style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(panel.title)}</h1>
    <p class="state">${escapeHtml(panel.displayState)}</p>
    <p>${escapeHtml(panel.operatorMessage)}</p>
    <h2>Current freeze</h2>
    <p>Branch: <code>${escapeHtml(panel.currentFreeze.branch)}</code></p>
    <p>Commit: <code>${escapeHtml(panel.currentFreeze.commit)}</code></p>
    <p>Freeze tag: <code>${escapeHtml(panel.currentFreeze.freezeTag ?? "none")}</code></p>
    <h2>Summary</h2>
    <table>
      <thead><tr><th>Item</th><th>Value</th><th>Severity</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Safety</h2>
    <p>Final decision: <code>${escapeHtml(panel.finalDecision)}</code></p>
    <p>Broker contact allowed: <code>${escapeHtml(panel.brokerContactAllowed)}</code></p>
    <p>Order placement allowed: <code>${escapeHtml(panel.brokerOrderPlacementAllowed)}</code></p>
    <p>No execution controls: <code>${escapeHtml(panel.noExecutionControls)}</code></p>
  </main>
</body>
</html>`;
}

export { VERSION as PAPER_ATTEMPT_READ_ONLY_OPERATOR_SUMMARY_PANEL_VERSION };
