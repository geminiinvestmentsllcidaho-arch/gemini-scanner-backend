import http from "node:http";

function getJson(path) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: "127.0.0.1", port: 3000, path, timeout: 10000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve({ ok: true, statusCode: res.statusCode, json: JSON.parse(body) }); }
        catch { resolve({ ok: false, statusCode: res.statusCode, error: "INVALID_JSON", body: body.slice(0, 250) }); }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`TIMEOUT ${path}`)));
    req.on("error", (err) => resolve({ ok: false, statusCode: 0, error: err.message }));
  });
}

function n(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

const healthRes = await getJson("/health");
const rankingsRes = await getJson("/scanner/rankings");

const health = healthRes.json || {};
const scanner = rankingsRes.json || {};
const rows = Array.isArray(scanner.rankings) ? scanner.rankings : [];

const nonZeroCount = rows.filter((r) =>
  n(r.setupScore) > 0 || n(r.normalizedScore) > 0 || n(r.confidence) > 0 || n(r.compositeConfidence) > 0
).length;

const p3False = rows.filter((r) => r.p3GateOk !== true).map((r) => r.symbol).filter(Boolean);
const alerts = [];

if (!healthRes.ok || healthRes.statusCode !== 200) alerts.push({ level: "critical", code: "HEALTH_UNREACHABLE" });
if (!rankingsRes.ok || rankingsRes.statusCode !== 200) alerts.push({ level: "critical", code: "RANKINGS_UNREACHABLE" });
if (health.degraded === true) alerts.push({ level: "warning", code: "HEALTH_DEGRADED", issues: health.issues || [] });
if (health.stream?.streamConnected === false) alerts.push({ level: "warning", code: "STREAM_DISCONNECTED" });
if (health.stream?.streamStale === true) alerts.push({ level: "warning", code: "STREAM_STALE" });
if (rows.length === 0) alerts.push({ level: "critical", code: "NO_RANKINGS" });
if (rows.length > 0 && nonZeroCount === 0) alerts.push({ level: "critical", code: "ZERO_RANKINGS" });
if (p3False.length > 0) alerts.push({ level: "warning", code: "P3_GATE_FALSE", symbols: p3False });
if (n(scanner.rankingConfidence) < 0.15) alerts.push({ level: "warning", code: "LOW_RANKING_CONFIDENCE", value: scanner.rankingConfidence });

const criticalCount = alerts.filter((a) => a.level === "critical").length;
const warningCount = alerts.filter((a) => a.level === "warning").length;

console.log(JSON.stringify({
  ok: criticalCount === 0,
  generatedAt: new Date().toISOString(),
  summary: {
    criticalCount,
    warningCount,
    scannerHealth: scanner.scannerHealth,
    rankingConfidence: scanner.rankingConfidence,
    telemetryCoverage: scanner.telemetryCoverage,
    totalRankings: rows.length,
    nonZeroCount,
    topSymbols: rows.slice(0, 5).map((r) => r.symbol),
  },
  alerts,
}, null, 2));

if (criticalCount > 0) process.exit(1);
