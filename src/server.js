require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { isMarketOpen } = require("./utils/isMarketOpen");
const morgan = require("morgan");
const { writeRunLog } = require("./utils/runlog");
const { readRunLog } = require("./utils/runlog_read");
const { listRuns } = require("./utils/runlog_index");
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("combined"));

const startedAt = Date.now();
const counters = {
  requestsTotal: 0,
  byPath: Object.create(null)
};

const state = {
  lastRun: null
};

app.use((req, _res, next) => {
  counters.requestsTotal += 1;
  const p = req.path || "/";
  counters.byPath[p] = (counters.byPath[p] || 0) + 1;
  next();
});

const getRules = () => ({
  assetClass: process.env.ASSET_CLASS,
  priceMin: Number(process.env.PRICE_MIN),
  priceMax: Number(process.env.PRICE_MAX),
  marketHoursOnly: process.env.MARKET_HOURS_ONLY === "true",
  lcmEnabled: process.env.LCM_DEFAULT === "true"
});

const computeAllowedSummary = () => {

  const rules = getRules();



  if (rules.marketHoursOnly) {

    const market = isMarketOpen();



    if (!market.open) {

      return {

        allowed: false,

        reason: market.reason,

        rules,

        ts: new Date().toISOString(),

        etTime: market.etTime

      };

    }

  }



  return {

    allowed: true,

    reason: "market_open",

    rules,

    ts: new Date().toISOString()

  };

};

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "GeminiScanner",
    rules: getRules(),
    ts: new Date().toISOString()
  });
});

// Read-only rules endpoint (decision-assist; no execution)
app.get("/rules", (req, res) => {
  res.json(getRules());
});

app.get("/health-fefb9b1cb37f6025a74db6599b783f12", (req, res) => {
  res.json({ ok: true, service: "GeminiScanner", ts: new Date().toISOString() });
});

// Decision-assist summary (no symbols, no execution)
app.get("/signal/summary", (req, res) => {
  res.json(computeAllowedSummary());
});

// Live Coaching Mode (LCM) status: descriptive only
app.get("/lcm/status", (req, res) => {
  const rules = getRules();
  const enabled = !!rules.lcmEnabled;
  res.json({
    enabled,
    mode: "coach",
    scope: "decision-assist",
    notes: ["No execution", "Signals are advisory only"],
    ts: new Date().toISOString()
  });
});

/**
 * Operator endpoints (behind Basic Auth via Nginx location /)
 * - No trading
 * - No Alpaca calls
 * - No symbols yet
 */
app.get("/ops/status", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    service: "GeminiScanner",
    ok: true,
    version: "1.0.0",
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    now: new Date().toISOString(),
    rules: getRules(),
    lcm: { enabled: getRules().lcmEnabled, scope: "decision-assist" },
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed
    },
    counters
  });
});

app.get("/ops/last-run", (req, res) => {
  res.json({
    lastRun: state.lastRun,
    ts: new Date().toISOString()
  });
});

app.get("/ops/runs", (req, res) => {
  const limitRaw = Number(req.query.limit || 25);
  const limit = Math.max(1, Math.min(200, limitRaw || 25));
  const runs = listRuns(limit);
  return res.json({ ok: true, limit, runs, ts: new Date().toISOString() });
});

// Public-ish alias for run listing (keeps same payload as /ops/runs; preserves query string)
app.get("/runlog", (req, res) => {
  const limitRaw = Number(req.query.limit || 25);
  const limit = Math.max(1, Math.min(200, limitRaw || 25));
  const runs = listRuns(limit);
  return res.json({ ok: true, limit, runs, ts: new Date().toISOString() });
});

app.get("/ops/replay/:runId", (req, res) => {
  try {
    const runId = req.params.runId;
    const original = readRunLog(runId);

    const t0 = Date.now();
    const startedAtIso = new Date(t0).toISOString();
    const summary = computeAllowedSummary();

    const replay = {
      runId: "replay-" + runId,
      dryRun: true,
      allowed: summary.allowed,
      reason: summary.reason,
      rules: summary.rules,
      startedAt: startedAtIso,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - t0
    };

    const diff = {
      allowedChanged: !!(original?.response?.allowed !== replay.allowed),
      reasonChanged: !!(original?.response?.reason !== replay.reason),
      rulesChanged: JSON.stringify(original?.response?.rules) !== JSON.stringify(replay.rules)
    };

    return res.json({ ok: true, runId, original, replay, diff, ts: new Date().toISOString() });
  } catch (e) {
    return res.status(404).json({ ok: false, error: "run_not_found", message: e.message });
  }
});

app.post("/ops/run", async (req, res) => {
  const runId = cryptoRandomId();
  const t0 = Date.now();
  const startedAtIso = new Date(t0).toISOString();

  const summary = computeAllowedSummary();

  // Dry run only: record what would happen, but do NOT scan symbols or place orders.
  const result = {
    runId,
    dryRun: true,
    allowed: summary.allowed,
    reason: summary.reason,
    rules: summary.rules,
    startedAt: startedAtIso,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0
  };

  state.lastRun = result;

  // === RunLog write ===
  try {
    writeRunLog({
      schemaVersion: 1,
      kind: "ops.run",
      runId,
      startedAt: startedAtIso,
      finishedAt: result.finishedAt,
      durationMs: result.durationMs,
      request: {
        body: req.body,
        ip: req.ip,
        ua: req.headers["user-agent"] || null
      },
      response: result
    });
    } catch (e) {
    console.error("RunLog write failed:", e.message);
  }

  res.json(result);
});

function cryptoRandomId() {
  // Avoid extra deps; good enough for run IDs
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

const port = Number(process.env.PORT || 3000);
app.listen(port, "127.0.0.1", () => {
  console.log("GeminiScanner backend running on 127.0.0.1:" + port);
});
