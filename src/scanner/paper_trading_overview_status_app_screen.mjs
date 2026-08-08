import { getPaperTradingReadinessGate } from "./paper_trading_readiness_gate.mjs";
import { buildPaperBrokerRuntimeEnvironmentPreflightAppScreen } from "./paper_broker_runtime_environment_preflight_app_screen.mjs";
import { buildPaperBrokerNetworkAttemptStatusAppScreen } from "./paper_broker_network_attempt_status_app_screen.mjs";

export const VERSION = "paper_trading_overview_status_app_screen_v1";

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function boolValue(value) {
  return value === true;
}

function textValue(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
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

function safeBuild(label, fn) {
  try {
    return { ok: true, label, value: fn() };
  } catch (error) {
    return { ok: false, label, error: error?.message ?? String(error), value: {} };
  }
}

function fastReadinessSource() {
  return {
    route: "/app/paper-readiness-gate",
    status: "fast_preview_readonly",
    readinessPct: 0,
    safety: { liveTrading: false, autoTrading: false, accountMutation: false }
  };
}

function fastRuntimeSource() {
  return {
    route: "/app/paper-broker-runtime-environment-preflight",
    status: "fast_preview_readonly",
    runtimeEnvironmentReady: false,
    blockers: ["runtime_source_not_loaded"],
    safety: { liveTradingAllowed: false, autoTradingAllowed: false, accountMutationAllowed: false }
  };
}

function fastNetworkAttemptSource() {
  return {
    route: "/app/paper-broker-network-attempt-status",
    status: "fast_preview_no_network_attempt",
    reportFound: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    safety: { liveTradingAllowed: false, autoTradingAllowed: false, accountMutationAllowed: false }
  };
}

export function buildPaperTradingOverviewStatusAppScreen(input = {}) {
  const loadSources = input.loadSources !== false;
  const readinessResult = input.readiness
    ? { ok: true, label: "readiness", value: input.readiness }
    : (loadSources || input.readinessInput
      ? safeBuild("readiness", () => getPaperTradingReadinessGate({ input: input.readinessInput ?? {}, write: false }))
      : { ok: true, label: "readiness", value: fastReadinessSource() });
  const runtimeResult = input.runtime
    ? { ok: true, label: "runtime", value: input.runtime }
    : (loadSources || input.runtimeInput
      ? safeBuild("runtime", () => buildPaperBrokerRuntimeEnvironmentPreflightAppScreen(input.runtimeInput ?? {}))
      : { ok: true, label: "runtime", value: fastRuntimeSource() });
  const networkResult = input.networkAttempt
    ? { ok: true, label: "network_attempt", value: input.networkAttempt }
    : (loadSources || input.networkAttemptInput
      ? safeBuild("network_attempt", () => buildPaperBrokerNetworkAttemptStatusAppScreen(input.networkAttemptInput ?? {}))
      : { ok: true, label: "network_attempt", value: fastNetworkAttemptSource() });

  const readiness = objectValue(readinessResult.value);
  const runtime = objectValue(runtimeResult.value);
  const networkAttempt = objectValue(networkResult.value);

  const readinessSafety = objectValue(readiness.safety);
  const runtimeSafety = objectValue(runtime.safety);
  const networkSafety = objectValue(networkAttempt.safety);

  const networkAttemptRecorded = boolValue(networkAttempt.reportFound);
  const brokerContactAttempted = boolValue(networkAttempt.brokerContactAttempted);
  const orderSubmitAttempted = boolValue(networkAttempt.orderSubmitAttempted);
  const orderSubmitted = boolValue(networkAttempt.orderSubmitted);
  const accountMutationAttempted =
    boolValue(networkAttempt.accountMutationAttempted) ||
    boolValue(runtimeSafety.accountMutationAttempted);

  const liveTradingAllowed =
    boolValue(readinessSafety.liveTrading) ||
    boolValue(runtimeSafety.liveTradingAllowed) ||
    boolValue(networkSafety.liveTradingAllowed);
  const autoTradingAllowed =
    boolValue(readinessSafety.autoTrading) ||
    boolValue(runtimeSafety.autoTradingAllowed) ||
    boolValue(networkSafety.autoTradingAllowed);
  const accountMutationAllowed =
    boolValue(readinessSafety.accountMutation) ||
    boolValue(runtimeSafety.accountMutationAllowed) ||
    boolValue(networkSafety.accountMutationAllowed);

  const blockers = [
    ...arrayValue(runtime.blockers),
    ...(networkAttemptRecorded ? ["prior_one_shot_paper_network_attempt_recorded"] : [])
  ].map(String);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: "/app/paper-trading-overview-status",
    title: "Paper Trading Overview Status",
    subtitle: "read-only overview of current PAPER intent readiness, runtime preflight, and historical network-attempt status.",
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    noResetControls: true,
    status: "paper_trading_overview_readonly_broker_blocked",
    displayState: "PAPER_TRADING_OVERVIEW_READONLY_BROKER_BLOCKED",
    summary: {
      readinessStatus: textValue(readiness.status, "unknown"),
      readinessPct: readiness.readinessPct ?? 0,
      runtimeStatus: textValue(runtime.status, "unknown"),
      runtimeEnvironmentReady: boolValue(runtime.runtimeEnvironmentReady),
      networkAttemptStatus: textValue(networkAttempt.status, "unknown"),
      networkAttemptRecorded,
      brokerContactAttempted,
      orderSubmitAttempted,
      orderSubmitted,
      accountMutationAttempted
    },
    safety: {
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      liveTradingAllowed,
      autoTradingAllowed,
      accountMutationAllowed,
      brokerExecutionAllowed: false,
      newBrokerContactAllowed: false,
      retryAllowed: false,
      resetAllowed: false,
      orderPlacementAllowed: false
    },
    sources: {
      readiness: { ok: readinessResult.ok, status: textValue(readiness.paperIntentStatus ?? readiness.status, "unknown"), route: "/app/paper-readiness-gate" },
      runtime: { ok: runtimeResult.ok, status: textValue(runtime.status, "unknown"), route: textValue(runtime.route, "/app/paper-broker-runtime-environment-preflight") },
      networkAttempt: { ok: networkResult.ok, status: textValue(networkAttempt.status, "unknown"), route: textValue(networkAttempt.route, "/app/paper-broker-network-attempt-status") }
    },
    blockers,
    links: {
      app: "/app",
      alpacaPaperAccount: "/app/alpaca-paper-account-status",
      runtimePreflight: "/app/paper-broker-runtime-environment-preflight",
      networkAttemptStatus: "/app/paper-broker-network-attempt-status",
      readinessGate: "/app/paper-readiness-gate",
      lifecycleDashboard: "/app/paper-lifecycle-dashboard",
      moduleFinalStatus: "/app/paper-trading-module-final-status",
      routeIndex: "/app/paper-trading-module-route-index"
    }
  };
}

export function renderPaperTradingOverviewStatusAppScreenHtml(input = {}) {
  const screen = input?.version === VERSION ? input : buildPaperTradingOverviewStatusAppScreen(input);
  const summary = objectValue(screen.summary);
  const safety = objectValue(screen.safety);
  const sources = objectValue(screen.sources);
  const links = objectValue(screen.links);
  const blockers = arrayValue(screen.blockers);
  const sourceCards = [
    ["Alpaca Paper Account", "Connected read-only account status.", links.alpacaPaperAccount],
    ["Runtime Preflight", sources.runtime?.status ?? "unknown", links.runtimePreflight],
    ["Network Attempt Status", sources.networkAttempt?.status ?? "unknown", links.networkAttemptStatus],
    ["Readiness Gate", sources.readiness?.status ?? "unknown", links.readinessGate],
    ["Lifecycle Dashboard", "Local lifecycle dashboard.", links.lifecycleDashboard],
    ["Module Final Status", "read-only module final status.", links.moduleFinalStatus],
    ["Route Index", "read-only route index.", links.routeIndex]
  ];

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>${esc(screen.title)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#0b1020;color:#eef3ff}main{max-width:1120px;margin:0 auto;padding:24px}a{color:#93c5fd}.card{border:1px solid #263452;background:#111a2e;border-radius:16px;padding:18px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.metric{border:1px solid #263452;border-radius:12px;padding:12px;background:#0e172a}.k{color:#aab7d4;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.v{font-size:20px;font-weight:700;margin-top:4px}.blocked{color:#fecaca}.ok{color:#bbf7d0}code{color:#bfdbfe;overflow-wrap:anywhere}</style></head><body><main>
<p><a href="${esc(links.app ?? "/app")}">App</a> / ${esc(screen.title)}</p><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p>
<section class="card"><div class="k">Overview state</div><p class="blocked">read-only only. No retry, no reset, no new broker contact, no order submit, no account mutation, no execution controls.</p><p>Status: <strong>${esc(screen.status)}</strong></p><p>Display state: <code>${esc(screen.displayState)}</code></p></section>
<section class="grid">
<div class="metric"><div class="k">Readiness status</div><div class="v">${esc(summary.readinessStatus)}</div></div>
<div class="metric"><div class="k">Readiness %</div><div class="v">${esc(summary.readinessPct)}</div></div>
<div class="metric"><div class="k">Runtime ready</div><div class="v">${renderBool(summary.runtimeEnvironmentReady)}</div></div>
<div class="metric"><div class="k">Network attempt recorded</div><div class="v">${renderBool(summary.networkAttemptRecorded)}</div></div>
<div class="metric"><div class="k">Order submitted</div><div class="v">${renderBool(summary.orderSubmitted)}</div></div>
<div class="metric"><div class="k">Account mutation attempted</div><div class="v">${renderBool(summary.accountMutationAttempted)}</div></div>
</section>
<section class="card"><h2>Safety locks</h2><ul><li>Paper only: ${renderBool(safety.paperOnly)}</li><li>Manual only: ${renderBool(safety.manualOnly)}</li><li>One-shot only: ${renderBool(safety.oneShotOnly)}</li><li>Live trading allowed: ${renderBool(safety.liveTradingAllowed)}</li><li>Auto trading allowed: ${renderBool(safety.autoTradingAllowed)}</li><li>Broker execution allowed: ${renderBool(safety.brokerExecutionAllowed)}</li><li>New broker contact allowed: ${renderBool(safety.newBrokerContactAllowed)}</li><li>Retry allowed: ${renderBool(safety.retryAllowed)}</li><li>Reset allowed: ${renderBool(safety.resetAllowed)}</li><li>Order placement allowed: ${renderBool(safety.orderPlacementAllowed)}</li><li>Account mutation allowed: ${renderBool(safety.accountMutationAllowed)}</li></ul></section>
<section class="card"><h2>Linked app surfaces</h2><div class="grid">${sourceCards.map(([title, state, href]) => `<div class="metric"><div class="k">${esc(title)}</div><p>${esc(state)}</p><p><a href="${esc(href)}">Open</a></p></div>`).join("")}</div></section>
<section class="card"><h2>Blockers and reasons</h2><ul>${blockers.length ? blockers.map((item) => `<li>${esc(item)}</li>`).join("") : "<li>none</li>"}</ul></section>
<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-readiness-gate">Paper Trading Readiness Gate</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildPaperTradingOverviewStatusAppScreen;
