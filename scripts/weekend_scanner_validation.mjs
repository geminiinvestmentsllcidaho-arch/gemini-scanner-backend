import http from "node:http";

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: "127.0.0.1", port: 3000, path, timeout: 10000 },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Invalid JSON from ${path}: ${body.slice(0, 300)}`));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Timeout from ${path}`)));
    req.on("error", reject);
  });
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function pickRankings(payload) {
  return Array.isArray(payload?.rankings) ? payload.rankings : [];
}

function nonZeroRanking(r) {
  return num(r.setupScore) > 0 || num(r.normalizedScore) > 0 || num(r.confidence) > 0 || num(r.compositeConfidence) > 0;
}

const started = new Date().toISOString();

const health = await getJson("/health");
const rankingsPayload = await getJson("/scanner/rankings");
const rankings = pickRankings(rankingsPayload);
const top = rankings.slice(0, 8);

const nonZeroCount = rankings.filter(nonZeroRanking).length;
const p3OkCount = rankings.filter((r) => r.p3GateOk === true).length;
const symbolCount = new Set(rankings.map((r) => r.symbol).filter(Boolean)).size;

const checks = [
  ["health reachable", !!health],
  ["server ok/degraded readable", health?.status === "ok" || typeof health?.degraded === "boolean"],
  ["rankings array present", Array.isArray(rankings)],
  ["symbols present", symbolCount > 0],
  ["non-zero rankings", nonZeroCount > 0],
  ["p3 gate valid on at least one symbol", p3OkCount > 0],
];

const failed = checks.filter(([, ok]) => !ok);

console.log(JSON.stringify({
  ok: failed.length === 0,
  started,
  finished: new Date().toISOString(),
  health: {
    status: health?.status,
    degraded: health?.degraded,
    issues: health?.issues,
    stream: health?.stream,
  },
  scanner: {
    scannerHealth: rankingsPayload?.scannerHealth,
    rankingConfidence: rankingsPayload?.rankingConfidence,
    telemetryCoverage: rankingsPayload?.telemetryCoverage,
    totalRankings: rankings.length,
    symbolCount,
    nonZeroCount,
    p3OkCount,
    top: top.map((r) => ({
      rank: r.rank,
      symbol: r.symbol,
      p3GateOk: r.p3GateOk,
      setupScore: r.setupScore,
      normalizedScore: r.normalizedScore,
      confidence: r.confidence,
      compositeConfidence: r.compositeConfidence,
      scannerHealth: r.scannerHealth,
      reason: r.reason,
    })),
  },
  checks: Object.fromEntries(checks),
  failed: failed.map(([name]) => name),
}, null, 2));

if (failed.length) process.exit(1);
