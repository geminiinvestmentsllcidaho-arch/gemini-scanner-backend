import http from "node:http";

const CLOSED_OK = process.argv.includes("--closed-ok");
const WAIT_MS = Number(process.env.OPEN_VALIDATE_WAIT_MS || 70000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port: 3000, path, timeout: 10000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Invalid JSON from ${path}: ${body.slice(0, 250)}`)); }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout from ${path}`)));
    req.on("error", reject);
  });
}

function rankingsOf(p) {
  return Array.isArray(p?.rankings) ? p.rankings : [];
}

function sig(rows) {
  return JSON.stringify(rows.map((r) => [r.symbol, r.p3GateOk, r.setupScore, r.normalizedScore, r.confidence, r.compositeConfidence]));
}

function nonZero(r) {
  return Number(r.setupScore || 0) > 0 || Number(r.normalizedScore || 0) > 0 || Number(r.confidence || 0) > 0 || Number(r.compositeConfidence || 0) > 0;
}

const health1 = await getJson("/health");
const a = await getJson("/scanner/rankings");
const rowsA = rankingsOf(a);

if (!CLOSED_OK) await sleep(WAIT_MS);

const health2 = await getJson("/health");
const b = await getJson("/scanner/rankings");
const rowsB = rankingsOf(b);

const changed = sig(rowsA) !== sig(rowsB);
const p3OkCount = rowsB.filter((r) => r.p3GateOk === true).length;
const nonZeroCount = rowsB.filter(nonZero).length;

const checks = {
  "health reachable": !!health2,
  "rankings present": rowsB.length > 0,
  "non-zero rankings": nonZeroCount > 0,
  "p3 gate true": p3OkCount > 0,
  "live movement detected": CLOSED_OK ? true : changed,
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);

console.log(JSON.stringify({
  ok: failed.length === 0,
  mode: CLOSED_OK ? "closed-market-safe" : "market-open",
  healthBefore: { status: health1?.status, degraded: health1?.degraded, stream: health1?.stream },
  healthAfter: { status: health2?.status, degraded: health2?.degraded, stream: health2?.stream },
  scanner: {
    scannerHealth: b?.scannerHealth,
    rankingConfidence: b?.rankingConfidence,
    telemetryCoverage: b?.telemetryCoverage,
    totalRankings: rowsB.length,
    p3OkCount,
    nonZeroCount,
    changed,
    top: rowsB.slice(0, 5).map((r) => ({
      rank: r.rank,
      symbol: r.symbol,
      p3GateOk: r.p3GateOk,
      setupScore: r.setupScore,
      normalizedScore: r.normalizedScore,
      confidence: r.confidence,
      compositeConfidence: r.compositeConfidence,
      reason: r.reason,
    })),
  },
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
