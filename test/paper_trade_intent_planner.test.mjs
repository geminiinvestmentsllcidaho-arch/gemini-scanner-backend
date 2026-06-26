import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperTradeIntentPlan,
  PAPER_TRADE_INTENT_PLANNER_VERSION,
} from "../src/scanner/paper_trade_intent_planner.mjs";

test("paper trade intent planner blocks when readiness gate is blocked", () => {
  const result = buildPaperTradeIntentPlan({
    readinessGate: {
      version: "paper-trading-readiness-gate-v1",
      allowedToCreatePaperIntent: false,
      paperIntentStatus: "blocked",
      issues: ["paper_trading_enabled"],
      candidate: { symbol: "AAPL", rankingConfidence: 0.9, rankingQuality: 0.9, sourceAgeSec: 1 },
    },
  }, { nowMs: 1700000000000 });

  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADE_INTENT_PLANNER_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.brokerContacted, false);
  assert.equal(result.orderPlacement, "disabled");
  assert.equal(result.canCreateIntent, false);
  assert.equal(result.paperTradeIntentStatus, "blocked");
  assert.equal(result.intent, null);
  assert.ok(result.issues.includes("readiness_gate_blocked"));
});

test("paper trade intent planner creates monitor-only intent when gate passes", () => {
  const result = buildPaperTradeIntentPlan({
    side: "buy",
    lastPrice: 10,
    readinessGate: {
      version: "paper-trading-readiness-gate-v1",
      allowedToCreatePaperIntent: true,
      paperIntentStatus: "ready",
      issues: [],
      ts: "2023-11-14T22:13:20.000Z",
      candidate: { symbol: "MSFT", rankingConfidence: 0.8, rankingQuality: 0.75, sourceAgeSec: 2 },
    },
  }, { nowMs: 1700000000000, limits: { maxNotionalUsd: 1000, maxRiskPct: 0.01 } });

  assert.equal(result.canCreateIntent, true);
  assert.equal(result.paperTradeIntentStatus, "created");
  assert.equal(result.brokerContacted, false);
  assert.equal(result.accountMutation, "disabled");
  assert.equal(result.intent.symbol, "MSFT");
  assert.equal(result.intent.side, "buy");
  assert.equal(result.intent.type, "market");
  assert.equal(result.intent.entry, 10);
  assert.equal(result.intent.stop, 9.7);
  assert.equal(result.intent.takeProfit, 10.6);
  assert.equal(result.intent.notionalUsd, 600);
  assert.match(result.intent.intentId, /^pti_[a-f0-9]{16}$/);
});

test("paper trade intent planner blocks when action is watch", () => {
  const result = buildPaperTradeIntentPlan({
    readinessGate: {
      version: "paper-trading-readiness-gate-v1",
      allowedToCreatePaperIntent: true,
      paperIntentStatus: "ready",
      issues: [],
      candidate: { symbol: "SPY", rankingConfidence: 0.8, rankingQuality: 0.8, sourceAgeSec: 2 },
    },
  });

  assert.equal(result.canCreateIntent, false);
  assert.equal(result.intent, null);
  assert.ok(result.issues.includes("action_not_tradeable"));
});

test("paper trade intent planner blocks when entry price is missing", () => {
  const result = buildPaperTradeIntentPlan({
    side: "buy",
    readinessGate: {
      version: "paper-trading-readiness-gate-v1",
      allowedToCreatePaperIntent: true,
      paperIntentStatus: "ready",
      issues: [],
      candidate: { symbol: "NVDA", rankingConfidence: 0.8, rankingQuality: 0.8, sourceAgeSec: 2 },
    },
  });

  assert.equal(result.canCreateIntent, false);
  assert.equal(result.intent, null);
  assert.ok(result.issues.includes("entry_price_missing"));
});
