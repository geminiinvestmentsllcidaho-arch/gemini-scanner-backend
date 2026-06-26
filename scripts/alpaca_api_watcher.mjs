import fs from "node:fs";
import crypto from "node:crypto";

const STATE_FILE = process.env.ALPACA_API_WATCH_STATE || "runs/alpaca_api_watch_state.json";
const REPORT_FILE = process.env.ALPACA_API_WATCH_REPORT || "runs/alpaca_api_watch_report.json";

const TARGETS = [
  {
    id: "alpaca_changelog",
    label: "Alpaca Docs Changelog",
    url: "https://docs.alpaca.markets/us/changelog",
    category: "docs_changelog",
  },
  {
    id: "market_data_getting_started",
    label: "Market Data API",
    url: "https://docs.alpaca.markets/us/docs/getting-started-with-alpaca-market-data",
    category: "market_data",
  },
  {
    id: "trading_api_getting_started",
    label: "Trading API",
    url: "https://docs.alpaca.markets/us/docs/getting-started-with-trading-api",
    category: "trading_api",
  },
  {
    id: "alpaca_status",
    label: "Alpaca Status",
    url: "https://status.alpaca.markets/",
    category: "status",
  },
];

const KEYWORDS = [
  "deprecat", "sunset", "breaking", "removed", "migration", "rate limit",
  "websocket", "stream", "market data", "trading api", "paper-api",
  "orders", "positions", "account", "auth", "request id", "x-request-id",
];

function ensureDir(file) {
  fs.mkdirSync(file.split("/").slice(0, -1).join("/"), { recursive: true });
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { version: "alpaca_api_watch_v1", targets: {} }; }
}

function saveJson(file, data) {
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function normalize(text) {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 250000);
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function keywordHits(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.filter((k) => lower.includes(k));
}

function severityFor(change, hits) {
  if (!change) return "none";
  if (hits.some((h) => ["deprecat", "sunset", "breaking", "removed", "migration"].includes(h))) return "high";
  if (hits.length) return "medium";
  return "low";
}

async function fetchTarget(t) {
  const started = Date.now();
  try {
    const res = await fetch(t.url, {
      headers: { "user-agent": "GeminiScanner-Alpaca-API-Watcher/1.0" },
    });
    const body = await res.text();
    const text = normalize(body);
    return {
      id: t.id,
      label: t.label,
      url: t.url,
      category: t.category,
      reachable: true,
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - started,
      hash: hash(text),
      keywordHits: keywordHits(text),
      sample: text.slice(0, 260),
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      id: t.id,
      label: t.label,
      url: t.url,
      category: t.category,
      reachable: false,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: err?.message || String(err),
      checkedAt: new Date().toISOString(),
    };
  }
}

const state = loadState();
const results = [];

for (const target of TARGETS) {
  const current = await fetchTarget(target);
  const previous = state.targets[target.id] || null;
  const changed = !!previous?.hash && !!current.hash && previous.hash !== current.hash;
  const firstSeen = !previous?.hash && !!current.hash;
  const severity = severityFor(changed, current.keywordHits || []);

  results.push({
    ...current,
    firstSeen,
    changed,
    previousHash: previous?.hash || null,
    severity,
  });

  if (current.hash) {
    state.targets[target.id] = {
      id: target.id,
      label: target.label,
      url: target.url,
      category: target.category,
      hash: current.hash,
      lastStatus: current.status,
      lastKeywordHits: current.keywordHits,
      lastCheckedAt: current.checkedAt,
      lastChangedAt: changed ? current.checkedAt : previous?.lastChangedAt || null,
    };
  }
}

state.updatedAt = new Date().toISOString();

const changed = results.filter((r) => r.changed);
const unreachable = results.filter((r) => !r.reachable || !r.ok);
const high = changed.filter((r) => r.severity === "high");

const report = {
  ok: true,
  mode: "monitor_only_no_auto_patch",
  generatedAt: new Date().toISOString(),
  summary: {
    targetCount: results.length,
    changedCount: changed.length,
    highSeverityCount: high.length,
    unreachableCount: unreachable.length,
    actionRequired: high.length > 0 || unreachable.length > 0,
  },
  recommendedAction:
    high.length > 0
      ? "Review Alpaca API docs changes before patching. Do not auto-apply production changes."
      : unreachable.length > 0
        ? "Retry watcher and check provider/network status."
        : changed.length > 0
          ? "Review medium/low API doc changes."
          : "No API changes detected.",
  results,
};

saveJson(STATE_FILE, state);
saveJson(REPORT_FILE, report);

console.log(JSON.stringify(report, null, 2));
