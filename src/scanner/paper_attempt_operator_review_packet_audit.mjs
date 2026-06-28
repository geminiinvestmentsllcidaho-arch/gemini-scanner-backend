import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const VERSION = "paper_attempt_operator_review_packet_audit_v1";
const DEFAULT_LEDGER_PATH = "runs/paper_attempt_operator_review_packet_audit.jsonl";
const PANEL_REPORT_SCRIPT = "scripts/paper_attempt_operator_review_packet_panel_report.mjs";

function nowIso(nowMs = Date.now()) {
  return new Date(nowMs).toISOString();
}

function safeString(value, fallback = "unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function extractJson(stdout) {
  if (!stdout || typeof stdout !== "string") return null;
  const first = stdout.indexOf("{");
  const last = stdout.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    return JSON.parse(stdout.slice(first, last + 1));
  } catch {
    return null;
  }
}

function fallbackReviewPacketPanel() {
  return {
    ok: true,
    version: "paper_attempt_operator_review_packet_panel_v1",
    panelType: "operator_dashboard_card",
    status: "review_blocked_no_go",
    reviewOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    blockerCount: 3,
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
  };
}

export function loadPaperAttemptOperatorReviewPacketPanel({ cwd = process.cwd() } = {}) {
  const scriptPath = path.join(cwd, PANEL_REPORT_SCRIPT);
  if (!fs.existsSync(scriptPath)) return fallbackReviewPacketPanel();

  try {
    const stdout = execFileSync("node", [scriptPath], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000,
    });
    return extractJson(stdout) || fallbackReviewPacketPanel();
  } catch {
    return fallbackReviewPacketPanel();
  }
}

export function normalizePaperAttemptOperatorReviewPacketPanel(panel = fallbackReviewPacketPanel()) {
  return {
    ok: safeBool(panel.ok, false),
    version: safeString(panel.version, "paper_attempt_operator_review_packet_panel_v1"),
    panelType: safeString(panel.panelType, "operator_dashboard_card"),
    status: safeString(panel.status, "review_blocked_no_go"),
    reviewOnly: safeBool(panel.reviewOnly, true),
    noExecutionControls: safeBool(panel.noExecutionControls, true),
    brokerContactAllowed: safeBool(panel.brokerContactAllowed, false),
    brokerOrderPlacementAllowed: safeBool(panel.brokerOrderPlacementAllowed, false),
    blockerCount: safeNumber(panel.blockerCount, 0),
    finalDecision: safeString(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
  };
}

export function buildPaperAttemptOperatorReviewPacketAudit({
  nowMs = Date.now(),
  panel,
  persist = false,
  ledgerPath = DEFAULT_LEDGER_PATH,
  cwd = process.cwd(),
} = {}) {
  const source = normalizePaperAttemptOperatorReviewPacketPanel(
    panel || loadPaperAttemptOperatorReviewPacketPanel({ cwd })
  );

  const sourceUnsafe =
    source.status !== "review_blocked_no_go" ||
    source.finalDecision !== "NO_GO_FOR_ORDER_PLACEMENT" ||
    source.reviewOnly !== true ||
    source.noExecutionControls !== true ||
    source.brokerContactAllowed !== false ||
    source.brokerOrderPlacementAllowed !== false;

  const createdAt = nowIso(nowMs);

  const safety = {
    decisionAssistOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    auditOnly: true,
    reviewOnly: true,
    noExecutionControls: true,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
  };

  const recordBasis = JSON.stringify({
    version: VERSION,
    createdAt,
    sourceVersion: source.version,
    sourceStatus: source.status,
    sourceFinalDecision: source.finalDecision,
    forcedFinalDecision: safety.finalDecision,
  });

  const recordId = crypto.createHash("sha256").update(recordBasis).digest("hex").slice(0, 24);

  const result = {
    ok: true,
    version: VERSION,
    auditType: "paper_attempt_operator_review_packet_audit",
    status: sourceUnsafe ? "audit_recorded_review_blocked_no_go_source_normalized" : "audit_recorded_review_blocked_no_go",
    auditOnly: true,
    appendOnly: true,
    immutableRecord: true,
    reviewOnly: true,
    noExecutionControls: true,
    finalDecision: safety.finalDecision,
    safety,
    source: {
      route: "/diagnostics/paper-attempt-operator-review-packet-panel",
      viewRoute: "/diagnostics/paper-attempt-operator-review-packet-panel-view",
      version: source.version,
      panelType: source.panelType,
      status: source.status,
      blockerCount: source.blockerCount,
      finalDecision: source.finalDecision,
      reviewOnly: source.reviewOnly,
      noExecutionControls: source.noExecutionControls,
      brokerContactAllowed: source.brokerContactAllowed,
      brokerOrderPlacementAllowed: source.brokerOrderPlacementAllowed,
      sourceUnsafe,
    },
    audit: {
      recordId,
      createdAt,
      ledgerPath,
      persisted: false,
      persistenceMode: persist ? "append_jsonl" : "preview_only",
      schemaLocked: true,
    },
  };

  if (persist) {
    const absoluteLedgerPath = path.isAbsolute(ledgerPath) ? ledgerPath : path.join(cwd, ledgerPath);
    fs.mkdirSync(path.dirname(absoluteLedgerPath), { recursive: true });
    fs.appendFileSync(absoluteLedgerPath, `${JSON.stringify(result)}\n`);
    result.audit.persisted = true;
  }

  return result;
}

export function renderPaperAttemptOperatorReviewPacketAuditHtml(audit) {
  const safeAudit = audit || buildPaperAttemptOperatorReviewPacketAudit();

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const rows = [
    ["Status", safeAudit.status],
    ["Final Decision", safeAudit.finalDecision],
    ["Audit Only", safeAudit.auditOnly],
    ["Append Only", safeAudit.appendOnly],
    ["Immutable Record", safeAudit.immutableRecord],
    ["Review Only", safeAudit.reviewOnly],
    ["No Execution Controls", safeAudit.noExecutionControls],
    ["Broker Contact Allowed", safeAudit.safety?.brokerContactAllowed],
    ["Broker Order Placement Allowed", safeAudit.safety?.brokerOrderPlacementAllowed],
    ["Source Status", safeAudit.source?.status],
    ["Source Blocker Count", safeAudit.source?.blockerCount],
    ["Source Unsafe", safeAudit.source?.sourceUnsafe],
    ["Record ID", safeAudit.audit?.recordId],
    ["Ledger Path", safeAudit.audit?.ledgerPath],
    ["Persisted", safeAudit.audit?.persisted],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Paper Attempt Operator Review Packet Audit</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }
    .card { max-width: 980px; border: 1px solid #334155; border-radius: 14px; padding: 20px; background: #111827; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #7f1d1d; color: #fee2e2; font-weight: 700; }
    table { border-collapse: collapse; width: 100%; margin-top: 18px; }
    td { border-top: 1px solid #334155; padding: 10px 8px; vertical-align: top; }
    td:first-child { color: #94a3b8; width: 300px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #020617; padding: 14px; border-radius: 10px; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Paper Attempt Operator Review Packet Audit</h1>
    <div class="badge">${esc(safeAudit.finalDecision)}</div>
    <table>
      ${rows.map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join("\n      ")}
    </table>
    <h2>JSON</h2>
    <pre>${esc(JSON.stringify(safeAudit, null, 2))}</pre>
  </div>
</body>
</html>`;
}

export default buildPaperAttemptOperatorReviewPacketAudit;
