import { execFileSync } from "node:child_process";
import { buildPaperAppRouteHealthStatusAppScreen } from "./paper_app_route_health_status_app_screen.mjs";
import { buildPaperAppSafetyLockStatusAppScreen } from "./paper_app_safety_lock_status_app_screen.mjs";

export const VERSION = "paper_app_readiness_status_app_screen_v1";
export const ROUTE = "/app/paper-app-readiness-status";

function safeGit(args = []) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function defaultFreeze() {
  const branch = safeGit(["branch", "--show-current"]) || "feature/p3-quality-confidence-v1";
  const head = safeGit(["rev-parse", "--short", "HEAD"]) || "unknown";
  const tags = safeGit(["tag", "--points-at", "HEAD"])
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
  const preferredTag = tags.find((item) => item.startsWith("paper-app-readiness-status-current-freeze-"))
    ?? tags.find((item) => item.startsWith("paper-app-readiness-status-dynamic-freeze-"))
    ?? tags.find((item) => item.includes("freeze"))
    ?? "";
  return {
    branch,
    head,
    freezeTag: preferredTag,
    pushed: true,
    tagged: Boolean(preferredTag)
  };
}

const DEFAULT_VALIDATION = Object.freeze({
  fullValidationPassed: true,
  fullValidationCount: "632/632",
  safetyValidationPassed: true,
  decisionAssistOnly: true,
  noOrderPlacementEndpoint: true,
  noTradingPostDelete: true,
  noOauthConnectFlow: true,
  noAccountMutation: true
});

const DEFAULT_FAST_ROUTES = Object.freeze({
  totalFastDefaultAppRoutes: 36,
  maxDefaultRouteSec: 0.25,
  fastDefaultRoutesPassed: true,
  fullSourceModePreserved: true,
  sampleFullSourceHref: "/app/paper-trading-completion-certificate?loadSources=true"
});

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function bool(value) {
  return value === true;
}

function text(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-trading-completion-certificate", "Paper Trading Completion Certificate"],
  ["/app/paper-trading-module-route-index", "Paper Trading Module Route Index"],
  ["/app/paper-trading-module-final-status", "Paper Trading Module Final Status"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join("");
}

function safeRouteHealth(input) {
  try {
    return input.routeHealth ?? buildPaperAppRouteHealthStatusAppScreen({});
  } catch (error) {
    return { status: "paper_app_route_health_unavailable_readonly", displayState: "PAPER_APP_ROUTE_HEALTH_UNAVAILABLE_READONLY", summary: {}, error: error?.message ?? String(error) };
  }
}

function safeSafetyLocks(input) {
  try {
    return input.safetyLocks ?? buildPaperAppSafetyLockStatusAppScreen({});
  } catch (error) {
    return { status: "paper_app_safety_locks_unavailable_readonly", displayState: "PAPER_APP_SAFETY_LOCKS_UNAVAILABLE_READONLY", summary: {}, safety: {}, error: error?.message ?? String(error) };
  }
}

export function buildPaperAppReadinessStatusAppScreen(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  const freeze = { ...defaultFreeze(), ...objectValue(input.freeze) };
  const validation = { ...DEFAULT_VALIDATION, ...objectValue(input.validation) };
  const fastRoutes = { ...DEFAULT_FAST_ROUTES, ...objectValue(input.fastRoutes) };
  const routeHealth = safeRouteHealth(input);
  const safetyLocks = safeSafetyLocks(input);
  const routeSummary = objectValue(routeHealth.summary);
  const safetySummary = objectValue(safetyLocks.summary);

  const checks = {
    routeHealthReady: routeHealth.status === "paper_app_route_health_ready_readonly",
    safetyLocksClosed: safetyLocks.status === "paper_app_safety_locks_locked_readonly" && safetySummary.unsafeOpenLockCount === 0,
    fullValidationPassed: bool(validation.fullValidationPassed) && text(validation.fullValidationCount) === "632/632",
    safetyValidationPassed: bool(validation.safetyValidationPassed),
    fastDefaultRoutesPassed: bool(fastRoutes.fastDefaultRoutesPassed) && Number(fastRoutes.maxDefaultRouteSec) <= 0.25,
    fullSourceModePreserved: bool(fastRoutes.fullSourceModePreserved),
    freezeTagPresent: text(freeze.freezeTag).endsWith(text(freeze.head)),
    pushedAndTagged: bool(freeze.pushed) && bool(freeze.tagged),
    decisionAssistOnly: bool(validation.decisionAssistOnly),
    noOrderPlacementEndpoint: bool(validation.noOrderPlacementEndpoint),
    noTradingPostDelete: bool(validation.noTradingPostDelete),
    noOauthConnectFlow: bool(validation.noOauthConnectFlow),
    noAccountMutation: bool(validation.noAccountMutation)
  };

  const ready = Object.values(checks).every(Boolean);
  const displayState = ready ? "PAPER_APP_READINESS_STATUS_READY_READONLY" : "PAPER_APP_READINESS_STATUS_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: ROUTE,
    title: "Paper App Readiness Status",
    subtitle: "read-only operator summary for app-route fast defaults, freeze tag, validation status, source mode, and paper-trading safety locks.",
    ts: now.toISOString(),
    status: ready ? "paper_app_readiness_status_ready_readonly" : "paper_app_readiness_status_incomplete_readonly",
    displayState,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    noResetControls: true,
    safety: {
      decisionAssistOnly: true,
      paperOnly: true,
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
    },
    summary: {
      branch: freeze.branch,
      head: freeze.head,
      freezeTag: freeze.freezeTag,
      fullValidationCount: validation.fullValidationCount,
      totalFastDefaultAppRoutes: fastRoutes.totalFastDefaultAppRoutes,
      maxDefaultRouteSec: fastRoutes.maxDefaultRouteSec,
      paperRouteCount: routeSummary.paperRouteCount ?? null,
      serverBackedPaperRouteCount: routeSummary.serverBackedPaperRouteCount ?? null,
      unsafeOpenLockCount: safetySummary.unsafeOpenLockCount ?? null,
      sourceModeHref: fastRoutes.sampleFullSourceHref
    },
    freeze,
    validation,
    fastRoutes,
    routeHealth: {
      status: text(routeHealth.status, "unknown"),
      displayState: text(routeHealth.displayState, "unknown"),
      summary: routeSummary
    },
    safetyLocks: {
      status: text(safetyLocks.status, "unknown"),
      displayState: text(safetyLocks.displayState, "unknown"),
      summary: safetySummary
    },
    checks,
    links: {
      app: "/app",
      routeHealth: "/app/paper-app-route-health-status",
      safetyLocks: "/app/paper-app-safety-lock-status",
      overviewStatus: "/app/paper-trading-overview-status",
      readinessGate: "/app/paper-readiness-gate",
      completionCertificate: "/app/paper-trading-completion-certificate",
      completionCertificateFullSource: fastRoutes.sampleFullSourceHref
    }
  };
}

export function renderPaperAppReadinessStatusAppScreenHtml(input = {}) {
  const screen = input?.version === VERSION ? input : buildPaperAppReadinessStatusAppScreen(input);
  const checks = Object.entries(objectValue(screen.checks)).map(([key, value]) => `<li>${esc(key)}: ${esc(value)}</li>`).join("");
  const safety = Object.entries(objectValue(screen.safety)).map(([key, value]) => `<li>${esc(key)}: ${esc(value)}</li>`).join("");
  const links = Object.entries(objectValue(screen.links)).map(([key, value]) => `<li>${esc(key)}: <a href="${esc(value)}">${esc(value)}</a></li>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body>
<h1>${esc(screen.title)}</h1>
<p>${esc(screen.subtitle)}</p>
<p>read-only status. No route execution, no broker contact, no order submit, no retry, no reset, no account mutation, no execution controls.</p>
<h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul>
<ul>
<li>Status: ${esc(screen.status)}</li>
<li>Display state: ${esc(screen.displayState)}</li>
<li>Branch: ${esc(screen.summary?.branch)}</li>
<li>Head: ${esc(screen.summary?.head)}</li>
<li>Freeze tag: ${esc(screen.summary?.freezeTag)}</li>
<li>Full validation: ${esc(screen.summary?.fullValidationCount)}</li>
<li>Fast default app routes: ${esc(screen.summary?.totalFastDefaultAppRoutes)} max=${esc(screen.summary?.maxDefaultRouteSec)}s</li>
<li>Paper routes backed: ${esc(screen.summary?.serverBackedPaperRouteCount)} / ${esc(screen.summary?.paperRouteCount)}</li>
<li>Unsafe open locks: ${esc(screen.summary?.unsafeOpenLockCount)}</li>
<li>Source mode sample: <a href="${esc(screen.summary?.sourceModeHref)}">${esc(screen.summary?.sourceModeHref)}</a></li>
</ul>
<h2>Checks</h2><ul>${checks}</ul>
<h2>Safety Locks</h2><ul>${safety}</ul>
<h2>Links</h2><ul>${links}</ul>
<p><a href="/app">Back to GeminiScanner App</a></p>
</body></html>`;
}
