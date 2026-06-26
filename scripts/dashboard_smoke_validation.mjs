import http from "node:http";
import fs from "node:fs";

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port: 3000, path, timeout: 10000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout from ${path}`)));
    req.on("error", reject);
  });
}

const dashboard = await get("/scanner/stage2-app");
const operatorSource = fs.readFileSync("src/operator/operator_dashboard.mjs", "utf8");
const rankingsRes = await get("/scanner/rankings");

let rankings = {};
try { rankings = JSON.parse(rankingsRes.body); } catch {}

const rows = Array.isArray(rankings.rankings) ? rankings.rankings : [];
const nonZeroCount = rows.filter((r) =>
  Number(r.setupScore || 0) > 0 ||
  Number(r.normalizedScore || 0) > 0 ||
  Number(r.confidence || 0) > 0 ||
  Number(r.compositeConfidence || 0) > 0
).length;

const checks = {
  "dashboard route reachable": dashboard.statusCode === 200,
  "dashboard html present": dashboard.body.length > 500,
  "alert badge present": dashboard.body.includes("scanner-alert-badge") || operatorSource.includes("scanner-alert-badge"),
  "rankings route reachable": rankingsRes.statusCode === 200,
  "rankings present": rows.length > 0,
  "non-zero rankings": nonZeroCount > 0,
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

console.log(JSON.stringify({
  ok: failed.length === 0,
  dashboard: {
    statusCode: dashboard.statusCode,
    bytes: dashboard.body.length,
  },
  scanner: {
    statusCode: rankingsRes.statusCode,
    scannerHealth: rankings.scannerHealth,
    rankingConfidence: rankings.rankingConfidence,
    telemetryCoverage: rankings.telemetryCoverage,
    totalRankings: rows.length,
    nonZeroCount,
    topSymbols: rows.slice(0, 5).map((r) => r.symbol),
  },
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
