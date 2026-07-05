import fs from "node:fs";
import path from "node:path";

export const VERSION = "paper_broker_network_attempt_status_app_screen_v1";

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function textValue(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function boolValue(value) {
  return value === true;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBool(value) {
  return value ? "true" : "false";
}

function latestFile(runsDir, prefix) {
  if (!fs.existsSync(runsDir)) return null;
  const files = fs.readdirSync(runsDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort()
    .reverse();
  return files[0] ? path.join(runsDir, files[0]) : null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function latestApprovedFile(runsDir) {
  return latestFile(runsDir, "separate_explicit_paper_broker_network_implementation_approval_approved_");
}

function normalizePostAttempt(report, file) {
  const response = objectValue(report.response);
  const safety = objectValue(report.safety);
  const approval = objectValue(report.approval);
  const parameters = objectValue(report.parameters);
  const session = objectValue(report.session);

  return {
    reportFound: true,
    latestPostAttemptFile: file,
    status: textValue(report.runStatus, textValue(report.status, "unknown")),
    sourceStatus: textValue(report.status, "unknown"),
    ts: textValue(report.ts),
    readyForSinglePaperNetworkAttempt: boolValue(report.readyForSinglePaperNetworkAttempt),
    approvalRecordFound: boolValue(approval.approvalRecordFound),
    approvalRecordFile: textValue(report.approvalRecordFile, textValue(approval.approvalRecordFile)),
    brokerAdapterCallAttempted: boolValue(report.brokerAdapterCallAttempted),
    brokerContactAttempted: boolValue(report.brokerContactAttempted),
    orderSubmitAttempted: boolValue(report.orderSubmitAttempted),
    orderSubmitted: boolValue(report.orderSubmitted),
    accountMutationAttempted: boolValue(report.accountMutationAttempted),
    preAttemptAuditFile: textValue(report.preAttemptAuditFile),
    postAttemptAuditFile: textValue(report.postAttemptAuditFile, file),
    response: {
      ok: boolValue(response.ok),
      status: response.status ?? null,
      statusText: textValue(response.statusText),
      bodyPreview: textValue(response.bodyPreview)
    },
    parameters: {
      symbol: textValue(parameters.symbol),
      qty: parameters.qty ?? null,
      side: textValue(parameters.side),
      type: textValue(parameters.type),
      timeInForce: textValue(parameters.timeInForce)
    },
    session: {
      marketOpen: boolValue(session.marketOpen),
      label: [textValue(session.weekday), session.hour, session.minute].filter((v) => v !== "" && v !== undefined && v !== null).join(" ")
    },
    safety: {
      paperOnly: safety.paperOnly !== false,
      manualOnly: safety.manualOnly !== false,
      oneShotOnly: safety.oneShotOnly !== false,
      liveTradingAllowed: boolValue(safety.liveTradingAllowed),
      autoTradingAllowed: boolValue(safety.autoTradingAllowed),
      accountMutationAllowed: boolValue(safety.accountMutationAllowed),
      brokerAdapterCallAttempted: boolValue(safety.brokerAdapterCallAttempted ?? report.brokerAdapterCallAttempted),
      brokerContactAttempted: boolValue(safety.brokerContactAttempted ?? report.brokerContactAttempted),
      orderSubmitAttempted: boolValue(safety.orderSubmitAttempted ?? report.orderSubmitAttempted),
      orderSubmitted: boolValue(safety.orderSubmitted ?? report.orderSubmitted),
      accountMutationAttempted: boolValue(safety.accountMutationAttempted ?? report.accountMutationAttempted)
    },
    blockers: arrayValue(report.blockers).map(String)
  };
}

export function buildPaperBrokerNetworkAttemptStatusAppScreen(input = {}) {
  const runsDir = textValue(input.runsDir, "runs");
  const postFile = input.report ? null : latestFile(runsDir, "paper_broker_network_call_post_attempt_");
  const preFile = input.report ? null : latestFile(runsDir, "paper_broker_network_call_pre_attempt_");
  const approvalFile = input.report ? null : latestApprovedFile(runsDir);
  const report = input.report ?? (postFile ? readJson(postFile) : null);

  const base = {
    ok: true,
    version: VERSION,
    readOnly: true,
    monitorOnly: true,
    auditOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    noResetControls: true,
    title: "Paper Broker Network Attempt Status",
    route: "/app/paper-broker-network-attempt-status",
    diagnosticRoute: "/app/paper-broker-network-attempt-status",
    refreshRoute: "/app/paper-broker-network-attempt-status",
    latestPreAttemptFile: preFile ?? "",
    latestApprovalFile: approvalFile ?? ""
  };

  if (!report) {
    return {
      ...base,
      reportFound: false,
      latestPostAttemptFile: "",
      status: "no_network_attempt_record",
      sourceStatus: "none",
      readyForSinglePaperNetworkAttempt: false,
      approvalRecordFound: Boolean(approvalFile),
      approvalRecordFile: approvalFile ?? "",
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      response: {},
      parameters: {},
      session: {},
      safety: {
        paperOnly: true,
        manualOnly: true,
        oneShotOnly: true,
        liveTradingAllowed: false,
        autoTradingAllowed: false,
        accountMutationAllowed: false,
        brokerAdapterCallAttempted: false,
        brokerContactAttempted: false,
        orderSubmitAttempted: false,
        orderSubmitted: false,
        accountMutationAttempted: false
      },
      blockers: ["network_attempt_record_missing"]
    };
  }

  return {
    ...base,
    ...normalizePostAttempt(report, postFile ?? textValue(report.postAttemptAuditFile))
  };
}

export function renderPaperBrokerNetworkAttemptStatusAppScreenHtml(input = {}) {
  const screen = input?.version === VERSION ? input : buildPaperBrokerNetworkAttemptStatusAppScreen(input);
  const response = objectValue(screen.response);
  const safety = objectValue(screen.safety);
  const params = objectValue(screen.parameters);
  const session = objectValue(screen.session);
  const blockers = arrayValue(screen.blockers);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>${esc(screen.title)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#0b1020;color:#eef3ff}main{max-width:1080px;margin:0 auto;padding:24px}a{color:#93c5fd}.card{border:1px solid #263452;background:#111a2e;border-radius:16px;padding:18px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.metric{border:1px solid #263452;border-radius:12px;padding:12px;background:#0e172a}.k{color:#aab7d4;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.v{font-size:20px;font-weight:700;margin-top:4px}.blocked{color:#fecaca}.ok{color:#bbf7d0}code{color:#bfdbfe;overflow-wrap:anywhere}</style></head><body><main>
<p><a href="/app">App</a> / ${esc(screen.title)}</p><h1>${esc(screen.title)}</h1>
<section class="card"><div class="k">Read-only attempt state</div><p class="blocked">No retry, no new broker contact, no order submit, no account mutation, no reset controls.</p><p>Status: <strong>${esc(screen.status)}</strong></p><p>Report found: <strong>${renderBool(screen.reportFound)}</strong></p><p>Latest post-attempt record: <code>${esc(screen.latestPostAttemptFile)}</code></p><p>Latest pre-attempt record: <code>${esc(screen.latestPreAttemptFile)}</code></p><p>Approval record: <code>${esc(screen.approvalRecordFile || screen.latestApprovalFile)}</code></p></section>
<section class="card"><div class="k">Attempt flags</div><div class="grid"><div class="metric"><div class="k">Broker contact attempted</div><div class="v">${renderBool(screen.brokerContactAttempted)}</div></div><div class="metric"><div class="k">Order submit attempted</div><div class="v">${renderBool(screen.orderSubmitAttempted)}</div></div><div class="metric"><div class="k">Order submitted</div><div class="v">${renderBool(screen.orderSubmitted)}</div></div><div class="metric"><div class="k">Account mutation attempted</div><div class="v">${renderBool(screen.accountMutationAttempted)}</div></div></div></section>
<section class="card"><div class="k">Paper response summary</div><p>Response ok: <strong>${renderBool(response.ok)}</strong></p><p>Status code: <strong>${esc(response.status)}</strong> ${esc(response.statusText)}</p><p>Body preview: <code>${esc(response.bodyPreview)}</code></p></section>
<section class="card"><div class="k">Attempt parameters</div><p>Symbol: <strong>${esc(params.symbol)}</strong> | Qty: <strong>${esc(params.qty)}</strong> | Side: <strong>${esc(params.side)}</strong> | Type: <strong>${esc(params.type)}</strong> | TIF: <strong>${esc(params.timeInForce)}</strong></p><p>Market open at attempt check: <strong>${renderBool(session.marketOpen)}</strong> <code>${esc(session.label)}</code></p></section>
<section class="card"><div class="k">Safety locks</div><p>Paper only: <strong>${renderBool(safety.paperOnly)}</strong></p><p>Manual only: <strong>${renderBool(safety.manualOnly)}</strong></p><p>One-shot only: <strong>${renderBool(safety.oneShotOnly)}</strong></p><p>Live trading allowed: <strong>${renderBool(safety.liveTradingAllowed)}</strong></p><p>Auto trading allowed: <strong>${renderBool(safety.autoTradingAllowed)}</strong></p><p>Account mutation allowed: <strong>${renderBool(safety.accountMutationAllowed)}</strong></p></section>
<section class="card"><div class="k">Blockers recorded with attempt</div><ul>${blockers.length ? blockers.map((b) => `<li>${esc(b)}</li>`).join("") : "<li>none</li>"}</ul></section>
</main></body></html>`;
}
