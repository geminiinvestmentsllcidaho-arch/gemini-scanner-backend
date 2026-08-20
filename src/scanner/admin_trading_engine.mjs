import fs from "node:fs";
import path from "node:path";

const esc = (v) => String(v ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function latestFile(runsDir, prefix) {
  try {
    return fs.readdirSync(runsDir)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
      .sort()
      .reverse()
      .map((name) => path.join(runsDir, name))[0] ?? null;
  } catch {
    return null;
  }
}

function readJson(file) {
  try { return file ? JSON.parse(fs.readFileSync(file, "utf8")) : null; }
  catch { return null; }
}

function latencyMs(submittedAt, filledAt) {
  const a = Date.parse(submittedAt ?? "");
  const b = Date.parse(filledAt ?? "");
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? +(b - a).toFixed(3) : null;
}

export function collectAdminTradingEngine({ runsDir = "runs", alpacaAccess = null, systemHealth = null, automaticPaper = null } = {}) {
  const statusFile = latestFile(runsDir, "paper_order_readonly_status_check_");
  const postFile = latestFile(runsDir, "paper_broker_network_call_post_attempt_");
  const status = readJson(statusFile);
  const post = readJson(postFile);

  const order = Object.freeze({
    id: status?.alpacaOrderId ?? null,
    symbol: status?.symbol ?? post?.parameters?.symbol ?? null,
    qty: status?.qty ?? post?.parameters?.qty ?? null,
    side: status?.side ?? post?.parameters?.side ?? null,
    type: status?.type ?? post?.parameters?.type ?? null,
    status: status?.status ?? null,
    filledQty: status?.filledQty ?? null,
    submittedAt: status?.submittedAt ?? null,
    filledAt: status?.filledAt ?? null,
  });

  const executionLatencyMs = latencyMs(order.submittedAt, order.filledAt);
  const storedOrderKnown = Boolean(order.id || order.symbol || order.status);
  const openLike = new Set(["new","accepted","pending_new","partially_filled","accepted_for_bidding","pending_replace","pending_cancel"]);
  const activeStoredCount = storedOrderKnown && openLike.has(String(order.status ?? "").toLowerCase()) ? 1 : 0;

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    orderEvidence: Object.freeze({
      storedOrderKnown,
      activeStoredCount,
      latestStatus: order.status ?? "Unavailable",
      order,
      statusFile,
      postAttemptFile: postFile,
      evidenceScope: "latest_stored_paper_order_evidence",
    }),
    brokerage: Object.freeze({
      alpacaReadAccessEnabled: alpacaAccess?.enabled === true,
      accessMode: alpacaAccess?.accessMode ?? "Unavailable",
      lastStoredBrokerReadAttempted: status?.brokerReadAttempted === true,
      lastStoredBrokerContactAttempted: status?.brokerContactAttempted === true,
      lastStoredResponseStatus: status?.responseStatus ?? post?.response?.status ?? null,
      lastStoredResponseStatusText: status?.responseStatusText ?? post?.response?.statusText ?? null,
      source: "local_configuration_and_stored_evidence_only",
    }),
    execution: Object.freeze({
      submittedAt: order.submittedAt,
      filledAt: order.filledAt,
      submitToFillMs: executionLatencyMs,
      signalToSubmitMs: null,
      source: executionLatencyMs == null ? "stored_timestamps_unavailable" : "stored_order_timestamps",
    }),
    automaticPaper: Object.freeze({
      continuity: automaticPaper?.continuity ?? null,
      enter: automaticPaper?.enter ?? null,
      scale: automaticPaper?.scale ?? null,
      exit: automaticPaper?.exit ?? null,
      lifecycle: automaticPaper?.lifecycle ?? null,
      activation: automaticPaper?.activation ?? null,
      readiness: automaticPaper?.readiness ?? null,
      assurance: automaticPaper?.assurance ?? null,
      degradedBroker: automaticPaper?.degradedBroker ?? null,
      safety: Object.freeze({
        paperOnly: automaticPaper?.safety?.paperOnly === true,
        liveTradingAllowed: false,
        adminExecutionControls: false,
      }),
    }),
    readOnly: true,
    localEvidenceOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    orderCancellationAllowed: false,
    orderReplacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export function renderAdminTradingEngine(x) {
  const o = x.orderEvidence?.order ?? {};
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trading Engine &amp; Execution</title><style>.admin-action{display:inline-block;background:#00ffff;color:#000;border:1px solid #00ffff;border-radius:10px;padding:10px 14px;font-weight:800;text-decoration:none}
body{margin:0;background:#000;color:#39ff14;font-family:system-ui}main{max-width:1100px;margin:auto;padding:20px}a{color:#00ffff}.p{border:1px solid #39ff14;border-radius:14px;padding:18px;margin:14px 0}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.m{border:1px solid #39ff14;border-radius:9px;padding:10px}h1,h2,strong{color:#39ff14}code{color:#00ffff;word-break:break-all}</style></head><body><main>
<a class="admin-action" href="/admin">← Admin</a>
<section class="p"><h1>Trading Engine &amp; Execution</h1><p>Local stored PAPER evidence only. No broker request is made by this page.</p></section>
<section class="p"><h2>Active Orders &amp; Queue</h2><div class="g"><div class="m">Stored active count <strong>${esc(x.orderEvidence?.activeStoredCount)}</strong></div><div class="m">Latest status <strong>${esc(x.orderEvidence?.latestStatus)}</strong></div><div class="m">Symbol <strong>${esc(o.symbol ?? "Unavailable")}</strong></div><div class="m">Side / Qty <strong>${esc(o.side ?? "Unavailable")} ${esc(o.qty ?? "")}</strong></div></div><p>Scope: latest stored paper-order evidence; this is not a live broker queue.</p></section>
<section class="p"><h2>Brokerage API Status</h2><div class="g"><div class="m">Admin read access <strong>${x.brokerage?.alpacaReadAccessEnabled ? "ON" : "OFF"}</strong></div><div class="m">Last stored HTTP status <strong>${esc(x.brokerage?.lastStoredResponseStatus ?? "Unavailable")}</strong></div><div class="m">Last stored broker read <strong>${x.brokerage?.lastStoredBrokerReadAttempted ? "Yes" : "No"}</strong></div></div><p>Current page source: ${esc(x.brokerage?.source)}.</p></section>
<section class="p"><h2>Execution Latency Panel</h2><div class="g"><div class="m">Submit → fill <strong>${esc(x.execution?.submitToFillMs ?? "Unavailable")} ms</strong></div><div class="m">Signal → submit <strong>Not yet instrumented</strong></div></div><p>Submitted: ${esc(x.execution?.submittedAt ?? "Unavailable")}<br>Filled: ${esc(x.execution?.filledAt ?? "Unavailable")}</p></section>
<section class="p"><h2>Automatic Alpaca PAPER Execution</h2><div class="g"><div class="m">Continuity <strong>${x.automaticPaper?.continuity?.enabled ? "ARMED" : "OFF"}</strong><br>${esc(x.automaticPaper?.continuity?.lastStatus ?? "Unavailable")}</div><div class="m">ENTER <strong>${x.automaticPaper?.enter?.enabled ? "ARMED" : "OFF"}</strong><br>${esc(x.automaticPaper?.enter?.lastStatus ?? "Unavailable")}</div><div class="m">SCALE <strong>${x.automaticPaper?.scale?.enabled && x.automaticPaper?.scale?.scaleInEnabled && x.automaticPaper?.scale?.scaleOutEnabled ? "ARMED" : "OFF"}</strong><br>${esc(x.automaticPaper?.scale?.lastStatus ?? "Unavailable")}</div><div class="m">EXIT <strong>${x.automaticPaper?.exit?.enabled && x.automaticPaper?.exit?.running ? "ARMED" : "OFF"}</strong><br>${esc(x.automaticPaper?.exit?.lastStatus ?? "Unavailable")}</div></div><p>Observed runtime diagnostics only. This Admin page does not invoke any runner.</p></section>
<section class="p"><h2>Active PAPER Lifecycle</h2><div class="g"><div class="m">State <strong>${esc(x.automaticPaper?.lifecycle?.state ?? "Unavailable")}</strong></div><div class="m">Symbol <strong>${esc(x.automaticPaper?.lifecycle?.selectedSymbol ?? "Unavailable")}</strong></div><div class="m">Quantity <strong>${esc(x.automaticPaper?.lifecycle?.filledQuantity ?? "Unavailable")}</strong></div><div class="m">Average fill <strong>${esc(x.automaticPaper?.lifecycle?.averageFillPrice ?? "Unavailable")}</strong></div></div><p>Position identity: <code>${esc(x.automaticPaper?.lifecycle?.brokerPositionIdentity ?? "Unavailable")}</code></p></section>
<section class="p"><h2>Automatic Position Sizing</h2><div class="g"><div class="m">Policy <strong>5% / 7.5% / 10%</strong></div><div class="m">Hard ceiling <strong>10%</strong></div><div class="m">Last allocation <strong>${esc(x.automaticPaper?.enter?.lastSizing?.allocationPercent ?? "Unavailable")}%</strong></div><div class="m">Last quantity <strong>${esc(x.automaticPaper?.enter?.lastSizing?.quantity ?? "Unavailable")}</strong></div></div></section>
<section class="p"><h2>Execution Readiness &amp; Assurance</h2><div class="g"><div class="m">Infrastructure readiness <strong>${x.automaticPaper?.readiness?.infrastructureReady === true ? "READY" : x.automaticPaper?.readiness?.infrastructureReady === false ? "BLOCKED" : "Unavailable"}</strong></div><div class="m">Readiness watcher <strong>${esc(x.automaticPaper?.readiness?.status ?? "Unavailable")}</strong></div><div class="m">Execution assurance <strong>${x.automaticPaper?.assurance?.report?.healthy === true ? "HEALTHY" : x.automaticPaper?.assurance?.report?.healthy === false ? "UNHEALTHY" : "Unavailable"}</strong></div><div class="m">Safe repair authorization <strong>${x.automaticPaper?.assurance?.safeRepairAllowed === true ? "AUTHORIZED" : "OFF"}</strong></div><div class="m">Safe repair eligible <strong>${x.automaticPaper?.assurance?.safeRepairEligible === true ? "YES" : "NO"}</strong></div><div class="m">Open assurance incident <strong>${x.automaticPaper?.assurance?.incident ? "YES" : "NO"}</strong></div></div><p>Readiness blockers: <strong>${esc(Array.isArray(x.automaticPaper?.readiness?.blockers) && x.automaticPaper.readiness.blockers.length ? x.automaticPaper.readiness.blockers.join(", ") : "None")}</strong>. Safe repair is bounded to the execution-readiness watcher and does not authorize broker, order, account, strategy, threshold, sizing, AI-authority, or live-trading mutation.</p></section>
<section class="p"><h2>Reconciliation &amp; Protection State</h2><div class="g"><div class="m">ENTER <strong>${esc(x.automaticPaper?.enter?.lastReconciliation?.status ?? "Unavailable")}</strong></div><div class="m">SCALE <strong>${esc(x.automaticPaper?.scale?.lastReconciliation?.status ?? "Unavailable")}</strong></div><div class="m">EXIT <strong>${esc(x.automaticPaper?.exit?.lastReconciliationStatus ?? "Unavailable")}</strong></div><div class="m">EXIT incident <strong>${esc(x.automaticPaper?.exit?.lastIncidentCode ?? "None")}</strong></div><div class="m">Degraded broker <strong>${x.automaticPaper?.degradedBroker?.degraded === true ? "DEGRADED" : x.automaticPaper?.degradedBroker ? "CLEAR" : "Unavailable"}</strong></div></div><p>PAPER-only: <strong>${x.automaticPaper?.safety?.paperOnly ? "YES" : "NO"}</strong> | Live trading: <strong>DISABLED</strong> | Admin execution controls: <strong>NONE</strong>.</p></section>
<p>Read-only Admin observability. No order submit, cancel, replace, retry, runner invocation, broker mutation, or account mutation.</p>
</main></body></html>`;
}

export default { collectAdminTradingEngine, renderAdminTradingEngine };
