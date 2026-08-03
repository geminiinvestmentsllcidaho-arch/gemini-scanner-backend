import test from "node:test";
import assert from "node:assert/strict";
import { evaluateStage1UnattendedEntry, runStage1UnattendedEntry } from "../src/scanner/stage1_unattended_one_share_entry_controller.mjs";

const readyInput = {
  armed: true, paperAccountConfirmed: true, liveTradingDisabled: true,
  marketOpen: true, marketClockFresh: true, marketDataFresh: true,
  accountSnapshotFresh: true, zeroPositions: true, zeroOpenOrders: true,
  killSwitchHealthy: true, idempotencyReady: true, idempotencyKey: "stage1-2026-08-04",
  stopAfterSingleAttempt: true, maxSpreadPct: 1, maxSourceAgeSec: 30, minScore: 70,
  candidate: { symbol: "AAPL", state: "ENTER", buyRecommendation: true, stale: false, blocked: false, blockers: [], spreadPct: 0.05, sourceAgeSec: 4, score: 82 },
};

test("fails closed by default", () => {
  const result = evaluateStage1UnattendedEntry({});
  assert.equal(result.ready, false);
  assert.equal(result.order, null);
  assert.ok(result.blockers.includes("unattended_entry_not_armed"));
});

test("builds exactly one paper share when every gate passes", () => {
  const result = evaluateStage1UnattendedEntry(readyInput);
  assert.equal(result.ready, true);
  assert.deepEqual(result.order, { symbol: "AAPL", qty: 1, side: "buy", type: "market", timeInForce: "day", paperOnly: true });
  assert.equal(result.safety.liveTradingAllowed, false);
  assert.equal(result.safety.retryAllowed, false);
});

test("rejects stale wide-spread low-score candidate", () => {
  const result = evaluateStage1UnattendedEntry({ ...readyInput, candidate: { ...readyInput.candidate, stale: true, spreadPct: 4, sourceAgeSec: 90, score: 40 } });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("candidate_source_stale"));
  assert.ok(result.blockers.includes("candidate_spread_too_wide"));
  assert.ok(result.blockers.includes("candidate_source_too_old"));
  assert.ok(result.blockers.includes("candidate_score_too_low"));
});

test("never invokes adapter on blocked path", async () => {
  let calls = 0;
  const result = await runStage1UnattendedEntry({ ...readyInput, marketOpen: false }, { adapter: async () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.equal(result.adapterInvoked, false);
  assert.equal(result.orderSubmitted, false);
});

test("invokes adapter once with one-share paper order", async () => {
  let calls = 0;
  const result = await runStage1UnattendedEntry(readyInput, { adapter: async (order, context) => {
    calls += 1;
    assert.equal(order.qty, 1);
    assert.equal(order.paperOnly, true);
    assert.equal(context.stopAfterSingleAttempt, true);
    return { networkAttempted: true, orderSubmitAttempted: true, orderSubmitted: true, orderId: "paper-order-1" };
  }});
  assert.equal(calls, 1);
  assert.equal(result.orderSubmitted, true);
  assert.equal(result.status, "ONE_UNATTENDED_PAPER_SHARE_SUBMITTED");
});
