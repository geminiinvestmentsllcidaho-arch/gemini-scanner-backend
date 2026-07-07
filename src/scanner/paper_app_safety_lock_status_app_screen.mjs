import { buildAppNavigationReadonly } from "./app_navigation_readonly.mjs";

export const VERSION = "paper_app_safety_lock_status_app_screen_v1";
export const ROUTE = "/app/paper-app-safety-lock-status";

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

const CLOSED_SAFETY_LOCKS = Object.freeze({
  liveTradingAllowed: false,
  autoTradingAllowed: false,
  brokerExecutionAllowed: false,
  brokerContactAllowed: false,
  newBrokerContactAllowed: false,
  orderPlacementAllowed: false,
  orderSubmitAllowed: false,
  retryAllowed: false,
  resetAllowed: false,
  accountMutationAllowed: false,
  routeExecutionAllowed: false
});

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-adapter-approval-lock", "Paper Broker Adapter Approval Lock"],
  ["/app/paper-operator-start-here", "Paper Operator Start Here"],
  ["/app/paper-broker-adapter-approval-record-tool", "Paper Broker Adapter Approval Record Tool"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-trade-readiness-report", "Paper Trade Readiness Report"],
  ["/app/paper-trade-broker-integration-preflight-stack", "Paper Trade Broker Integration Preflight Stack"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${safe(href)}">${safe(label)}</a></li>`)
    .join("");
}

function normalizeEntry(entry = {}) {
  return {
    id: stableString(entry.id),
    title: stableString(entry.title || entry.label || entry.id),
    category: stableString(entry.category || "uncategorized"),
    routeHref: stableString(entry.routeHref || entry.href),
    displayState: stableString(entry.displayState),
    refreshFriendly: Boolean(entry.refreshFriendly)
  };
}

export function buildPaperAppSafetyLockStatusAppScreen({ entries = null, now = new Date() } = {}) {
  const navEntries = entries ?? buildAppNavigationReadonly({}).entries;
  const normalized = list(navEntries).map(normalizeEntry);
  const paperEntries = normalized.filter((entry) =>
    entry.routeHref.startsWith("/app/") &&
    /paper|broker|alpaca|operator|readiness|runtime|safety|lock/i.test(
      [entry.id, entry.title, entry.category, entry.routeHref, entry.displayState].join(" ")
    )
  );

  const safety = { ...CLOSED_SAFETY_LOCKS };
  const allSafetyLocksClosed = Object.values(safety).every((value) => value === false);
  const routeLinkedInNavigation = normalized.some((entry) => entry.routeHref === ROUTE);

  const checks = {
    allSafetyLocksClosed,
    routeLinkedInNavigation,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    noBrokerContact: true,
    noOrderSubmit: true,
    noRetry: true,
    noReset: true,
    noAccountMutation: true
  };

  const locked = Object.values(checks).every(Boolean);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: ROUTE,
    title: "Paper App Safety Lock Status",
    status: locked
      ? "paper_app_safety_locks_locked_readonly"
      : "paper_app_safety_locks_incomplete_readonly",
    displayState: locked
      ? "PAPER_APP_SAFETY_LOCK_STATUS_LOCKED_READONLY"
      : "PAPER_APP_SAFETY_LOCK_STATUS_INCOMPLETE_READONLY",
    ts: now.toISOString(),
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    noResetControls: true,
    safety,
    checks,
    summary: {
      totalNavigationEntries: normalized.length,
      paperNavigationEntries: paperEntries.length,
      lockedSafetyFlagCount: Object.keys(safety).length,
      unsafeOpenLockCount: Object.values(safety).filter(Boolean).length
    },
    entries: paperEntries
  };
}

export function renderPaperAppSafetyLockStatusAppScreenHtml(input = {}) {
  const report = input?.version === VERSION
    ? input
    : buildPaperAppSafetyLockStatusAppScreen(input);

  const safetyRows = Object.entries(report.safety ?? {})
    .map(([key, value]) => `<li>${safe(key)}: ${safe(value)}</li>`)
    .join("");

  const checkRows = Object.entries(report.checks ?? {})
    .map(([key, value]) => `<li>${safe(key)}: ${safe(value)}</li>`)
    .join("");

  const entryRows = list(report.entries)
    .map((entry) => `<li><code>${safe(entry.routeHref)}</code> | ${safe(entry.title)} | ${safe(entry.displayState)}</li>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<title>${safe(report.title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body>
<h1>${safe(report.title)}</h1>
<p>Read-only safety lock status for paper app routes.</p>
<p>No route execution, no broker contact, no order submit, no retry, no reset, no account mutation.</p>
<h2>Related Broker Readiness Routes</h2>
<ul>${renderRelatedBrokerReadinessRoutes()}</ul>
<ul>
<li>Status: ${safe(report.status)}</li>
<li>Display state: ${safe(report.displayState)}</li>
<li>Total navigation entries: ${safe(report.summary?.totalNavigationEntries)}</li>
<li>Paper navigation entries: ${safe(report.summary?.paperNavigationEntries)}</li>
<li>Locked safety flag count: ${safe(report.summary?.lockedSafetyFlagCount)}</li>
<li>Unsafe open lock count: ${safe(report.summary?.unsafeOpenLockCount)}</li>
<li>Read only: ${safe(report.readOnly)}</li>
<li>No execution controls: ${safe(report.noExecutionControls)}</li>
</ul>
<h2>Safety Locks</h2>
<ul>${safetyRows}</ul>
<h2>Checks</h2>
<ul>${checkRows}</ul>
<h2>Paper App Routes Covered</h2>
<ul>${entryRows}</ul>
</body>
</html>`;
}
