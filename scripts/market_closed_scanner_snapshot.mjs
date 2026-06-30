import fs from "node:fs";
import path from "node:path";

const VERSION = "market_closed_scanner_snapshot_v1";
const PORT = process.env.PORT || "3000";
const BASE_URL = process.env.SCANNER_BASE_URL || `http://127.0.0.1:${PORT}`;

function nowIso() {
  return new Date().toISOString();
}

function stampFromIso(iso) {
  return iso.replace(/[:.]/g, "-");
}

async function readJson(route) {
  const url = `${BASE_URL}${route}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { parseError: true, rawPreview: text.slice(0, 1200) };
    }

    return {
      ok: res.ok,
      code: res.status,
      route,
      url,
      json
    };
  } catch (err) {
    return {
      ok: false,
      code: 0,
      route,
      url,
      error: err?.message || String(err)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function safetyEnvelope() {
  return {
    readOnly: true,
    marketClosedBaseline: true,
    decisionAssistOnly: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false
  };
}

function compactRankings(rankingsJson) {
  const rankings = Array.isArray(rankingsJson?.rankings) ? rankingsJson.rankings : [];
  return rankings.slice(0, 8).map((r) => ({
    rank: r.rank ?? null,
    symbol: r.symbol ?? null,
    setupScore: r.setupScore ?? null,
    normalizedScore: r.normalizedScore ?? null,
    confidence: r.confidence ?? null,
    p3GateOk: r.p3GateOk ?? null,
    qualityOverall: r.qualityOverall ?? null,
    rsi: r.rsi ?? null,
    reason: Array.isArray(r.reason) ? r.reason.slice(0, 6) : []
  }));
}

function classify(snapshot) {
  const issues = [];

  const healthJson = snapshot.health?.json || {};
  const rankingsJson = snapshot.rankings?.json || {};

  if (!snapshot.health?.ok) issues.push("health_route_unavailable");
  if (!snapshot.rankings?.ok) issues.push("rankings_route_unavailable");
  if (healthJson.degraded) issues.push("health_degraded");
  if (Array.isArray(healthJson.issues)) {
    for (const issue of healthJson.issues) issues.push(`health_${String(issue).toLowerCase()}`);
  }
  if (rankingsJson.scannerHealth && rankingsJson.scannerHealth !== "ok") {
    issues.push(`scanner_health_${String(rankingsJson.scannerHealth).toLowerCase()}`);
  }
  if ((rankingsJson.rankingConfidence ?? 0) < 0.25) {
    issues.push("ranking_confidence_low");
  }

  const streamStale = Boolean(healthJson.stream?.streamStale);
  const marketClosedExpected = streamStale;

  return {
    status: issues.length ? "degraded" : "ok",
    displayState: issues.length ? "CAUTION" : "OK",
    marketClosedExpected,
    issues: [...new Set(issues)]
  };
}

const ts = nowIso();

const health = await readJson("/health");
const rankings = await readJson("/scanner/rankings");

const snapshot = {
  ok: true,
  version: VERSION,
  ts,
  baseUrl: BASE_URL,
  sessionNote: "MARKET_CLOSED_READ_ONLY_BASELINE",
  safety: safetyEnvelope(),
  health,
  rankings
};

snapshot.classification = classify(snapshot);
snapshot.compact = {
  status: snapshot.classification.status,
  displayState: snapshot.classification.displayState,
  issues: snapshot.classification.issues,
  health: {
    status: health.json?.status ?? null,
    degraded: health.json?.degraded ?? null,
    issues: health.json?.issues ?? [],
    stream: health.json?.stream ?? null
  },
  scanner: {
    ok: rankings.json?.ok ?? null,
    scannerHealth: rankings.json?.scannerHealth ?? null,
    rankingConfidence: rankings.json?.rankingConfidence ?? null,
    marketRegime: rankings.json?.marketRegime ?? null,
    riskState: rankings.json?.riskState ?? null,
    scannerReadiness: rankings.json?.scannerReadiness ?? null,
    top: compactRankings(rankings.json)
  }
};

const runsDir = path.resolve("runs");
fs.mkdirSync(runsDir, { recursive: true });

const stampedPath = path.join(runsDir, `market_closed_scanner_snapshot_${stampFromIso(ts)}.json`);
const latestPath = path.join(runsDir, "market_closed_scanner_snapshot_latest.json");

fs.writeFileSync(stampedPath, JSON.stringify(snapshot, null, 2));
fs.writeFileSync(latestPath, JSON.stringify(snapshot, null, 2));

console.log(JSON.stringify({
  ok: true,
  version: VERSION,
  ts,
  status: snapshot.classification.status,
  displayState: snapshot.classification.displayState,
  issues: snapshot.classification.issues,
  packet: stampedPath,
  latest: latestPath,
  compact: snapshot.compact
}, null, 2));
