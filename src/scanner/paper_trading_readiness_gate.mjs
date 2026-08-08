import fs from "node:fs";
import path from "node:path";

export const PAPER_TRADING_READINESS_GATE_VERSION = "paper-trading-readiness-gate-v1";

const DEFAULT_THRESHOLDS = Object.freeze({
  minRankingConfidence: 0.55,
  minRankingQuality: 0.55,
  maxSourceAgeSec: 600,
});

function asBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pushCheck(checks, key, ok, detail = {}) {
  checks.push({ key, ok: Boolean(ok), detail });
}

function getNested(obj, paths, fallback = undefined) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let good = true;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || !(part in cur)) {
        good = false;
        break;
      }
      cur = cur[part];
    }
    if (good) return cur;
  }
  return fallback;
}

export function evaluatePaperTradingReadinessGate(input = {}, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const nowMs = asNumber(options.nowMs, Date.now());
  const checks = [];
  const issues = [];

  const mode = String(input.mode || input.tradingMode || process.env.GEMINI_TRADING_MODE || "monitor").toLowerCase();

  const liveTradingEnabled = asBool(input.liveTradingEnabled ?? process.env.GEMINI_LIVE_TRADING_ENABLED ?? false);
  const paperTradingEnabled = asBool(input.paperTradingEnabled ?? process.env.GEMINI_PAPER_TRADING_ENABLED ?? false);

  const scannerHealth = String(getNested(input, ["scannerHealth", "health.scannerHealth", "ranking.scannerHealth", "dashboard.scannerHealth"], "unknown")).toLowerCase();
  const governanceState = String(getNested(input, ["governanceState", "governance.governanceState", "dashboard.governanceState"], "unknown")).toLowerCase();
  const portfolioPermission = String(getNested(input, ["portfolioPermission", "governance.portfolioPermission", "dashboard.portfolioPermission"], "unknown")).toLowerCase();

  const rankingConfidence = asNumber(getNested(input, ["rankingConfidence", "ranking.rankingConfidence", "dashboard.rankingConfidence", "topCandidate.rankingConfidence", "topCandidate.confidence"], null), null);
  const rankingQuality = asNumber(getNested(input, ["rankingQuality", "ranking.rankingQuality", "dashboard.rankingQuality", "topCandidate.qualityOverall", "topCandidate.quality"], null), null);
  const p3GateOk = asBool(getNested(input, ["p3GateOk", "p3_gate.ok", "topCandidate.p3GateOk", "topCandidate.p3_gate.ok"], false));
  const sourceAgeSec = asNumber(getNested(input, ["sourceAgeSec", "freshness.sourceAgeSec", "ranking.sourceAgeSec", "topCandidate.sourceAgeSec"], null), null);
  const candidateSymbol = getNested(input, ["symbol", "topCandidate.symbol", "candidate.symbol"], null);

  pushCheck(checks, "monitor_only_mode", mode !== "live", { mode });
  pushCheck(checks, "paper_trading_enabled", paperTradingEnabled, { paperTradingEnabled });
  pushCheck(checks, "live_trading_disabled", !liveTradingEnabled, { liveTradingEnabled });
  pushCheck(checks, "scanner_not_stale", scannerHealth === "ok" || scannerHealth === "healthy", { scannerHealth });
  pushCheck(checks, "governance_unlocked", !["locked", "blocked", "denied"].includes(governanceState), { governanceState });
  pushCheck(checks, "portfolio_permission_allowed", ["allowed", "approved", "paper_allowed"].includes(portfolioPermission), { portfolioPermission });
  pushCheck(checks, "ranking_confidence_minimum", rankingConfidence !== null && rankingConfidence >= thresholds.minRankingConfidence, { rankingConfidence, min: thresholds.minRankingConfidence });
  pushCheck(checks, "ranking_quality_minimum", rankingQuality !== null && rankingQuality >= thresholds.minRankingQuality, { rankingQuality, min: thresholds.minRankingQuality });
  pushCheck(checks, "p3_gate_ok", p3GateOk, { p3GateOk });
  pushCheck(checks, "fresh_source", sourceAgeSec !== null && sourceAgeSec <= thresholds.maxSourceAgeSec, { sourceAgeSec, maxSourceAgeSec: thresholds.maxSourceAgeSec });
  pushCheck(checks, "candidate_present", Boolean(candidateSymbol), { symbol: candidateSymbol });

  for (const check of checks) if (!check.ok) issues.push(check.key);

  const allowedToCreatePaperIntent = issues.length === 0;

  return {
    ok: true,
    version: PAPER_TRADING_READINESS_GATE_VERSION,
    ts: new Date(nowMs).toISOString(),
    mode,
    monitorOnly: true,
    allowedToCreatePaperIntent,
    paperIntentStatus: allowedToCreatePaperIntent ? "ready" : "blocked",
    safety: {
      orderPlacement: "disabled",
      liveTrading: "disabled",
      autoTrading: "disabled",
      brokerExecution: "disabled",
      accountMutation: "disabled",
    },
    thresholds,
    checks,
    issues,
    candidate: { symbol: candidateSymbol, rankingConfidence, rankingQuality, p3GateOk, sourceAgeSec },
  };
}

export function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function buildPaperTradingReadinessInputFromRuns(baseDir = process.cwd()) {
  const runsDir = path.join(baseDir, "runs");
  const rankings = readJsonIfExists(path.join(runsDir, "scanner_rankings_snapshot.json"));
  const liveSnapshot = readJsonIfExists(path.join(runsDir, "live_snapshot.json"));
  const rankingRoot = rankings || liveSnapshot || {};
  const topCandidate = Array.isArray(rankingRoot.rankings) ? rankingRoot.rankings[0] : null;

  return {
    mode: process.env.GEMINI_TRADING_MODE || "monitor",
    paperTradingEnabled: process.env.GEMINI_PAPER_TRADING_ENABLED || false,
    liveTradingEnabled: process.env.GEMINI_LIVE_TRADING_ENABLED || false,
    scannerHealth: rankingRoot.scannerHealth,
    governanceState: rankingRoot.governanceState,
    portfolioPermission: rankingRoot.portfolioPermission,
    rankingConfidence: rankingRoot.rankingConfidence,
    rankingQuality: rankingRoot.rankingQuality,
    sourceAgeSec: rankingRoot.sourceAgeSec,
    topCandidate,
  };
}

export function getPaperTradingReadinessGate(options = {}) {
  const input = options.input || buildPaperTradingReadinessInputFromRuns(options.baseDir || process.cwd());
  return evaluatePaperTradingReadinessGate(input, options);
}
