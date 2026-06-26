import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getPaperTradingReadinessGate } from "./paper_trading_readiness_gate.mjs";

export const PAPER_TRADE_INTENT_PLANNER_VERSION = "paper-trade-intent-planner-v1";

const DEFAULT_LIMITS = Object.freeze({
  maxNotionalUsd: 1000,
  maxRiskPct: 0.01,
  defaultTimeInForce: "day",
});

function asNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function normalizeSide(value) {
  const side = String(value || "").toLowerCase();
  if (["buy", "long", "enter_long"].includes(side)) return "buy";
  if (["sell", "short", "enter_short"].includes(side)) return "sell";
  return "watch";
}

function stableIntentId(payload) {
  const raw = JSON.stringify({
    version: PAPER_TRADE_INTENT_PLANNER_VERSION,
    symbol: payload.symbol,
    side: payload.side,
    entry: payload.entry,
    stop: payload.stop,
    takeProfit: payload.takeProfit,
    createdFromTs: payload.createdFromTs,
  });
  return `pti_${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
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

export function buildPaperTradeIntentPlan(input = {}, options = {}) {
  const nowMs = asNumber(options.nowMs, Date.now());
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };

  const readinessGate = input.readinessGate || input.gate || getPaperTradingReadinessGate({
    baseDir: options.baseDir || process.cwd(),
  });

  const candidate = input.candidate || readinessGate.candidate || {};
  const symbol = getNested(candidate, ["symbol"], null);
  const confidence = asNumber(getNested(candidate, ["rankingConfidence", "confidence"], null), null);
  const quality = asNumber(getNested(candidate, ["rankingQuality", "qualityOverall", "quality"], null), null);
  const sourceAgeSec = asNumber(getNested(candidate, ["sourceAgeSec"], null), null);

  const side = normalizeSide(
    input.side ||
    candidate.side ||
    candidate.action ||
    candidate.scannerActionBias ||
    candidate.decision ||
    "watch"
  );

  const lastPrice = asNumber(
    input.lastPrice ??
    candidate.lastPrice ??
    candidate.price ??
    candidate.close ??
    candidate.rsiPrice,
    null
  );

  const entry = lastPrice !== null ? roundMoney(lastPrice) : null;
  const stop = entry !== null && side === "buy" ? roundMoney(entry * 0.97) : null;
  const takeProfit = entry !== null && side === "buy" ? roundMoney(entry * 1.06) : null;

  const confidenceWeight = confidence === null ? 0 : clamp(confidence, 0, 1);
  const qualityWeight = quality === null ? 0 : clamp(quality, 0, 1);
  const notionalUsd = roundMoney(limits.maxNotionalUsd * confidenceWeight * qualityWeight);

  const blocked = !readinessGate.allowedToCreatePaperIntent;
  const issues = [];

  if (blocked) issues.push("readiness_gate_blocked");
  if (!symbol) issues.push("candidate_symbol_missing");
  if (side === "watch") issues.push("action_not_tradeable");
  if (entry === null) issues.push("entry_price_missing");

  const canCreateIntent = issues.length === 0;

  const base = {
    ok: true,
    version: PAPER_TRADE_INTENT_PLANNER_VERSION,
    ts: new Date(nowMs).toISOString(),
    monitorOnly: true,
    brokerContacted: false,
    orderPlacement: "disabled",
    accountMutation: "disabled",
    readinessGate: {
      version: readinessGate.version,
      allowedToCreatePaperIntent: readinessGate.allowedToCreatePaperIntent,
      paperIntentStatus: readinessGate.paperIntentStatus,
      issues: readinessGate.issues || [],
    },
    paperTradeIntentStatus: canCreateIntent ? "created" : "blocked",
    canCreateIntent,
    issues,
    limits,
  };

  if (!canCreateIntent) {
    return {
      ...base,
      intent: null,
      candidate: {
        symbol,
        side,
        confidence,
        quality,
        sourceAgeSec,
        entry,
      },
    };
  }

  const createdFromTs = readinessGate.ts || base.ts;
  const intentDraft = {
    symbol,
    side,
    type: "market",
    timeInForce: limits.defaultTimeInForce,
    entry,
    stop,
    takeProfit,
    notionalUsd,
    maxRiskPct: limits.maxRiskPct,
    confidence,
    quality,
    sourceAgeSec,
    createdFromTs,
    safetyMode: "paper-intent-only",
  };

  const intent = {
    intentId: stableIntentId(intentDraft),
    ...intentDraft,
  };

  return {
    ...base,
    intent,
    candidate: {
      symbol,
      side,
      confidence,
      quality,
      sourceAgeSec,
      entry,
    },
  };
}

export function writePaperTradeIntentPlan(result, baseDir = process.cwd()) {
  const outFile = path.join(baseDir, "runs", "paper_trade_intent_plan.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
  return outFile;
}

export function getPaperTradeIntentPlan(options = {}) {
  const result = buildPaperTradeIntentPlan(options.input || {}, options);
  if (options.write !== false) writePaperTradeIntentPlan(result, options.baseDir || process.cwd());
  return result;
}
