import http from "node:http";

const BASE = process.env.GS_BASE_URL || "http://127.0.0.1:3000";
const FAIL_ON_NO_GO = process.argv.includes("--fail-on-no-go");

function getJson(path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const req = http.get(url, { timeout: 10000, headers: { "user-agent": "gs-monday-freshness-decision" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve({ path, code: res.statusCode, json: JSON.parse(body) });
        } catch (error) {
          resolve({ path, code: res.statusCode, json: null, error: `json_parse_failed:${error.message}`, body: body.slice(0, 500) });
        }
      });
    });
    req.on("error", (error) => resolve({ path, code: 0, json: null, error: String(error) }));
    req.on("timeout", () => { req.destroy(); resolve({ path, code: 0, json: null, error: "timeout" }); });
  });
}

const healthResult = await getJson("/health");
const rankingsResult = await getJson("/scanner/rankings");
const routeResult = await getJson("/diagnostics/paper-app-route-health-status");

const health = healthResult.json ?? {};
const rankings = rankingsResult.json ?? {};
const route = routeResult.json ?? {};
const rows = Array.isArray(rankings.rankings) ? rankings.rankings : [];
const safety = route.safety ?? {};
const missing = route.missingServerRoutes ?? route.missing ?? [];
const unsafe = route.unsafe ?? [];

const checks = {
  healthReachable: healthResult.code === 200,
  healthStatusOk: health.status === "ok",
  healthNotDegraded: health.degraded === false,
  scannerReachable: rankingsResult.code === 200,
  scannerOk: rankings.ok === true,
  scannerFreshNotStale: rankings.scannerHealth !== "stale",
  scannerNotBlocked: rankings.scannerReadiness !== "blocked",
  hasRankings: rows.length > 0,
  hasP3GateOk: rows.some((row) => row.p3GateOk === true),
  routeHealthReachable: routeResult.code === 200,
  routeHealthOk: route.ok === true,
  routeHealthReadyReadonly: route.status === "paper_app_route_health_ready_readonly",
  noMissingRoutes: missing.length === 0,
  noUnsafeRoutes: unsafe.length === 0,
  liveTradingBlocked: safety.liveTradingAllowed === false,
  autoTradingBlocked: safety.autoTradingAllowed === false,
  orderPlacementBlocked: safety.orderPlacementAllowed === false,
  orderSubmitBlocked: safety.orderSubmitAllowed === false,
  accountMutationBlocked: safety.accountMutationAllowed === false
};

const passed = Object.values(checks).every(Boolean);
const decision = passed
  ? "MARKET_OPEN_FRESHNESS_PASS_OPERATOR_REVIEW_REQUIRED"
  : "NO_GO_MARKET_OPEN_FRESHNESS_NOT_PASSED";

const top = rows.slice(0, 5).map((row) => ({
  rank: row.rank ?? null,
  symbol: row.symbol ?? null,
  setupScore: row.setupScore ?? null,
  p3GateOk: row.p3GateOk ?? null,
  confidence: row.confidence ?? null,
  compositeConfidence: row.compositeConfidence ?? null,
  qualityOverall: row.qualityOverall ?? null,
  rsi: row.rsi ?? null
}));

const summary = {
  decision,
  checks,
  health: {
    code: healthResult.code,
    status: health.status ?? null,
    degraded: health.degraded ?? null,
    issues: health.issues ?? null,
    stream: health.stream ?? null
  },
  scanner: {
    code: rankingsResult.code,
    ok: rankings.ok ?? null,
    scannerHealth: rankings.scannerHealth ?? null,
    scannerReadiness: rankings.scannerReadiness ?? null,
    scannerBlockReason: rankings.scannerBlockReason ?? null,
    rankingConfidence: rankings.rankingConfidence ?? null,
    telemetryCoverage: rankings.telemetryCoverage ?? null,
    totalRankings: rows.length,
    top
  },
  routeHealth: {
    code: routeResult.code,
    ok: route.ok ?? null,
    status: route.status ?? null,
    displayState: route.displayState ?? null,
    missingCount: missing.length,
    unsafeCount: unsafe.length,
    readyForOrderPlacement: route.readyForOrderPlacement ?? null,
    orderPlacementAllowed: route.orderPlacementAllowed ?? safety.orderPlacementAllowed ?? null,
    accountMutationAllowed: route.accountMutationAllowed ?? safety.accountMutationAllowed ?? null
  },
  nextStepIfPass: "Review /app/paper-readiness-gate, /app/paper-trade-readiness-report, and /app/paper-trade-operator-go-no-go before any tiny paper attempt.",
  abort: [
    "pm2 stop gemini-scanner",
    "pm2 logs gemini-scanner --lines 100",
    "npm run validate:trading-safety",
    "npm run validate:connect-safety"
  ]
};

console.log(JSON.stringify(summary, null, 2));

if (!passed && FAIL_ON_NO_GO) {
  process.exitCode = 10;
}
