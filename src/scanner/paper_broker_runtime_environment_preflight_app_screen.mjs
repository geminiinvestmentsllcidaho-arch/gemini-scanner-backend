import fs from "node:fs";
import path from "node:path";

export const VERSION = "paper_broker_runtime_environment_preflight_app_screen_v1";

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

const RELATED_ROUTES = Object.freeze([
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
]);

function renderRelatedRoutes() {
  return RELATED_ROUTES
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join("");
}

function latestReportFile(runsDir = "runs") {
  if (!fs.existsSync(runsDir)) return null;
  const files = fs.readdirSync(runsDir)
    .filter((name) => name.startsWith("paper_broker_runtime_environment_preflight_") && name.endsWith(".json"))
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

export function buildPaperBrokerRuntimeEnvironmentPreflightAppScreen(input = {}) {
  const runsDir = textValue(input.runsDir, "runs");
  const shouldLoadReport = input.loadSourceReport !== false;
  const reportFile = (input.report || !shouldLoadReport) ? null : latestReportFile(runsDir);
  const report = input.report ?? (reportFile ? readJson(reportFile) : null);

  const base = {
    ok: true,
    version: VERSION,
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    title: "Paper Broker Runtime Environment Preflight",
    route: "/app/paper-broker-runtime-environment-preflight",
    diagnosticRoute: "/app/paper-broker-runtime-environment-preflight",
    refreshRoute: "/app/paper-broker-runtime-environment-preflight",
    reportFound: Boolean(report),
    status: report ? textValue(report.status, "unknown") : "no_runtime_preflight_report",
    runtimeEnvironmentReady: boolValue(report?.runtimeEnvironmentReady),
    blockers: report ? arrayValue(report.blockers).map(String) : ["runtime_preflight_report_missing"]
  };

  if (!report) {
    return {
      ...base,
      environment: {},
      implementation: {},
      parameters: {},
      safety: {
        paperOnly: true,
        liveTradingAllowed: false,
        autoTradingAllowed: false,
        accountMutationAllowed: false,
        networkAttempted: false,
        brokerContactAttempted: false,
        orderSubmitAttempted: false,
        orderSubmitted: false,
        accountMutationAttempted: false
      }
    };
  }

  const environment = objectValue(report.environment);
  const implementation = objectValue(report.implementationReadiness);
  const session = objectValue(implementation.session);
  const safety = objectValue(report.safety);
  const parameters = objectValue(report.parameters);

  return {
    ...base,
    reportFile: textValue(report.reportFile, reportFile ?? ""),
    ts: textValue(report.ts),
    environment: {
      alpacaPaperTradingBaseUrlPresent: boolValue(environment.alpacaPaperTradingBaseUrlPresent),
      alpacaPaperRoutePathPresent: boolValue(environment.alpacaPaperRoutePathPresent),
      alpacaApiKeyPresent: boolValue(environment.alpacaApiKeyPresent),
      alpacaApiSecretPresent: boolValue(environment.alpacaApiSecretPresent),
      keyPreview: textValue(environment.keyPreview, "redacted"),
      secretPreview: textValue(environment.secretPreview, "redacted"),
      routePreview: textValue(environment.routePreview, "redacted"),
      baseUrlPreview: textValue(environment.baseUrlPreview, "redacted")
    },
    implementation: {
      status: textValue(implementation.status, "unknown"),
      marketOpen: boolValue(session.marketOpen),
      sessionLabel: [textValue(session.weekday), session.hour, session.minute].filter((v) => v !== "" && v !== undefined && v !== null).join(" "),
      blockers: arrayValue(implementation.blockers).map(String)
    },
    parameters: {
      symbol: textValue(parameters.symbol),
      qty: parameters.qty ?? null,
      side: textValue(parameters.side),
      type: textValue(parameters.type),
      timeInForce: textValue(parameters.timeInForce)
    },
    safety: {
      paperOnly: safety.paperOnly !== false,
      liveTradingAllowed: boolValue(safety.liveTradingAllowed),
      autoTradingAllowed: boolValue(safety.autoTradingAllowed),
      accountMutationAllowed: boolValue(safety.accountMutationAllowed),
      networkAttempted: boolValue(safety.networkAttempted ?? report.networkAttempted),
      brokerContactAttempted: boolValue(safety.brokerContactAttempted ?? report.brokerContactAttempted),
      orderSubmitAttempted: boolValue(safety.orderSubmitAttempted ?? report.orderSubmitAttempted),
      orderSubmitted: boolValue(safety.orderSubmitted ?? report.orderSubmitted),
      accountMutationAttempted: boolValue(safety.accountMutationAttempted ?? report.accountMutationAttempted)
    }
  };
}

export function renderPaperBrokerRuntimeEnvironmentPreflightAppScreenHtml(input = {}) {
  const screen = input?.version === VERSION ? input : buildPaperBrokerRuntimeEnvironmentPreflightAppScreen(input);
  const env = objectValue(screen.environment);
  const impl = objectValue(screen.implementation);
  const safety = objectValue(screen.safety);
  const params = objectValue(screen.parameters);
  const blockers = arrayValue(screen.blockers);
  const implBlockers = arrayValue(impl.blockers);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>${esc(screen.title)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#0b1020;color:#eef3ff}main{max-width:1080px;margin:0 auto;padding:24px}a{color:#93c5fd}.card{border:1px solid #263452;background:#111a2e;border-radius:16px;padding:18px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.metric{border:1px solid #263452;border-radius:12px;padding:12px;background:#0e172a}.k{color:#aab7d4;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.v{font-size:20px;font-weight:700;margin-top:4px}.blocked{color:#fecaca}code{color:#bfdbfe;overflow-wrap:anywhere}</style></head><body><main>
<p><a href="/app">App</a> / ${esc(screen.title)}</p><h1>${esc(screen.title)}</h1>
<section class="card"><div class="k">Related Broker Readiness Routes</div><p hidden>Related broker readiness routes</p><ul>${renderRelatedRoutes()}</ul></section>
<section class="card"><div class="k">read-only runtime state</div><p class="blocked">No broker contact, no order submit, no account mutation, no execution controls.</p><p>Status: <strong>${esc(screen.status)}</strong></p><p>Runtime environment ready: <strong>${renderBool(screen.runtimeEnvironmentReady)}</strong></p><p>Latest report: <code>${esc(screen.reportFile ?? "")}</code></p></section>
<section class="card"><div class="k">Environment mapping</div><div class="grid"><div class="metric"><div class="k">Paper base URL</div><div class="v">${renderBool(env.alpacaPaperTradingBaseUrlPresent)}</div></div><div class="metric"><div class="k">Paper route path</div><div class="v">${renderBool(env.alpacaPaperRoutePathPresent)}</div></div><div class="metric"><div class="k">API key present</div><div class="v">${renderBool(env.alpacaApiKeyPresent)}</div></div><div class="metric"><div class="k">API secret present</div><div class="v">${renderBool(env.alpacaApiSecretPresent)}</div></div></div><p>Key preview: <code>${esc(env.keyPreview)}</code></p><p>Secret preview: <code>${esc(env.secretPreview)}</code></p></section>
<section class="card"><div class="k">Implementation readiness</div><p>Market open: <strong>${renderBool(impl.marketOpen)}</strong></p><ul>${implBlockers.length ? implBlockers.map((b) => `<li>${esc(b)}</li>`).join("") : "<li>none</li>"}</ul></section>
<section class="card"><div class="k">Preflight parameters</div><p>Symbol: <strong>${esc(params.symbol)}</strong> | Qty: <strong>${esc(params.qty)}</strong> | Side: <strong>${esc(params.side)}</strong> | Type: <strong>${esc(params.type)}</strong> | TIF: <strong>${esc(params.timeInForce)}</strong></p></section>
<section class="card"><div class="k">Safety locks</div><p>Paper only: <strong>${renderBool(safety.paperOnly)}</strong></p><p>Live trading allowed: <strong>${renderBool(safety.liveTradingAllowed)}</strong></p><p>Auto trading allowed: <strong>${renderBool(safety.autoTradingAllowed)}</strong></p><p>Network attempted: <strong>${renderBool(safety.networkAttempted)}</strong></p><p>Broker contact attempted: <strong>${renderBool(safety.brokerContactAttempted)}</strong></p><p>Order submitted: <strong>${renderBool(safety.orderSubmitted)}</strong></p><p>Account mutation attempted: <strong>${renderBool(safety.accountMutationAttempted)}</strong></p></section>
<section class="card"><div class="k">Runtime preflight blockers</div><ul>${blockers.length ? blockers.map((b) => `<li>${esc(b)}</li>`).join("") : "<li>none</li>"}</ul></section>
</main></body></html>`;
}
