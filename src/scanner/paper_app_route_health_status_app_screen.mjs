import { buildAppNavigationReadonly } from "./app_navigation_readonly.mjs";

export const VERSION = "paper_app_route_health_status_app_screen_v1";

export const ROUTE = "/app/paper-app-route-health-status";

const PAPER_ROUTE_RE = /paper|broker|safety|lock|runtime|attempt|readiness|operator|alpaca/i;

function stableString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function safe(value) {
  return stableString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function list(source) {
  return Array.isArray(source) ? source : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEntry(entry = {}) {
  const routeHref = stableString(entry.routeHref || entry.href);
  return {
    category: stableString(entry.category || "uncategorized"),
    label: stableString(entry.label || routeHref),
    routeHref,
    diagnostichref: stableString(entry.diagnosticHref || entry.diagnostichref || ""),
    refreshIntervalSec: Number.isFinite(Number(entry.refreshIntervalSec))
      ? Number(entry.refreshIntervalSec)
      : null
  };
}

export function buildPaperAppRouteHealthStatusAppScreen({ entries = null, now = new Date() } = {}) {
  const navEntries = entries ?? buildAppNavigationReadonly({}).entries;
  const normalized = list(navEntries).map(normalizeEntry);
  const paperRoutes = normalized
    .filter((entry) => entry.routeHref.startsWith("/app/") && PAPER_ROUTE_RE.test([entry.category, entry.label, entry.routeHref].join(" ")))
    .sort((a, b) => a.routeHref.localeCompare(b.routeHref));

  const routeList = paperRoutes.map((entry) => entry.routeHref);
  const uniqueRoutes = unique(routeList);

  const checks = {
    hasPaperRoutes: paperRoutes.length > 0,
    routeHrefsPresent: paperRoutes.every((entry) => entry.routeHref.startsWith("/app/")),
    routeHrefsUnique: uniqueRoutes.length === routeList.length,
    noExecutionControls: true,
    noBrokerContact: true,
    noOrderSubmit: true,
    noRetry: true,
    noAccountMutation: true
  };

  const ready = Object.values(checks).every(Boolean);
  const status = ready
    ? "paper_app_route_health_ready_readonly"
    : "paper_app_route_health_incomplete_readonly";

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: ROUTE,
    title: "Paper App Route Health Status",
    status,
    displayState: ready
      ? "PAPER_APP_ROUTE_HEALTH_READY_READONLY"
      : "PAPER_APP_ROUTE_HEALTH_INCOMPLETE_READONLY",
    ts: now.toISOString(),
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    noResetControls: true,
    safety: {
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      brokerExecutionAllowed: false,
      brokerContactAllowed: false,
      newBrokerContactAllowed: false,
      orderPlacementAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      resetAllowed: false,
      accountMutationAllowed: false
    },
    summary: {
      totalNavigationEntries: normalized.length,
      paperRouteCount: paperRoutes.length,
      uniquePaperRouteCount: uniqueRoutes.length,
      firstRoute: uniqueRoutes[0] ?? null,
      lastRoute: uniqueRoutes[uniqueRoutes.length - 1] ?? null
    },
    checks,
    routes: paperRoutes
  };
}

export function renderPaperAppRouteHealthStatusAppScreenHtml(input = {}) {
  const report = input?.version === VERSION
    ? input
    : buildPaperAppRouteHealthStatusAppScreen(input);

  const rows = list(report.routes)
    .map((entry) => `<li><code>${safe(entry.routeHref)}</code> | ${safe(entry.label)} | ${safe(entry.category)}</li>`)
    .join("");

  const checks = Object.entries(report.checks ?? {})
    .map(([key, value]) => `<li>${safe(key)}: ${safe(value)}</li>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<title>${safe(report.title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body>
<h1>${safe(report.title)}</h1>
<p>Read-only health screen for paper, broker, runtime, safety, readiness, operator, and Alpaca app routes.</p>
<p>No route execution, no broker contact, no order submit, no retry, no reset, no account mutation.</p>
<ul>
<li>Status: ${safe(report.status)}</li>
<li>Display state: ${safe(report.displayState)}</li>
<li>Total navigation entries: ${safe(report.summary?.totalNavigationEntries)}</li>
<li>Paper route count: ${safe(report.summary?.paperRouteCount)}</li>
<li>Unique paper route count: ${safe(report.summary?.uniquePaperRouteCount)}</li>
<li>Read only: ${safe(report.readOnly)}</li>
<li>No execution controls: ${safe(report.noExecutionControls)}</li>
</ul>
<h2>Checks</h2>
<ul>${checks}</ul>
<h2>Routes</h2>
<ul>${rows}</ul>
</body>
</html>`;
}
