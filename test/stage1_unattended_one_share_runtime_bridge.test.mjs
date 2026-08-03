import test from "node:test";
import assert from "node:assert/strict";
import { createStage1UnattendedOneShareRuntimeBridge } from "../src/scanner/stage1_unattended_one_share_runtime_bridge.mjs";

const nowMs = Date.parse("2026-08-03T20:00:00.000Z");
const snapshot = {
  ok: true,
  marketClock: { isOpen: true, timestamp: "2026-08-03T19:59:30.000Z" },
  candidates: [
    { symbol: "AAA", state: "ENTER", buyRecommendation: true, blocked: false, blockers: [], spreadPct: 0.2, sourceAgeSec: 4, score: 84 },
  ],
};
const account = {
  status: "connected_readonly",
  observedAt: "2026-08-03T19:59:45.000Z",
  runtime: { paperOnly: true },
  positions: [],
  openOrders: [],
};

test("runtime bridge is disabled by default and starts nothing", async () => {
  let adapterCalls = 0;
  let intervals = 0;
  const bridge = createStage1UnattendedOneShareRuntimeBridge({
    sharedScanCache: { getLatest: () => snapshot },
    fetchAccountSnapshot: async () => account,
    adapter: async () => { adapterCalls += 1; },
    now: () => nowMs,
    setIntervalImpl: () => { intervals += 1; return 1; },
    env: {},
  });

  const start = bridge.start();
  const run = await bridge.runOnce();
  assert.equal(start.bridgeEnabled, false);
  assert.equal(start.started, false);
  assert.equal(run.started, false);
  assert.equal(intervals, 0);
  assert.equal(adapterCalls, 0);
  assert.equal(start.safety.serverIntegrated, false);
});

test("bridge enable alone cannot bypass worker execution gate", async () => {
  let adapterCalls = 0;
  const bridge = createStage1UnattendedOneShareRuntimeBridge({
    sharedScanCache: { getLatest: () => snapshot },
    fetchAccountSnapshot: async () => account,
    adapter: async () => { adapterCalls += 1; },
    now: () => nowMs,
    env: {
      STAGE1_UNATTENDED_RUNTIME_BRIDGE_ENABLED: "1",
    },
  });

  const result = await bridge.runOnce();
  assert.equal(adapterCalls, 0);
  assert.equal(result.worker.lastResult.status, "DISABLED_BY_ENV");
  assert.equal(result.worker.attemptConsumed, false);
});

test("bridge fails closed when shared cache is unavailable", async () => {
  let adapterCalls = 0;
  const bridge = createStage1UnattendedOneShareRuntimeBridge({
    sharedScanCache: null,
    fetchAccountSnapshot: async () => account,
    adapter: async () => { adapterCalls += 1; },
    now: () => nowMs,
    env: {
      STAGE1_UNATTENDED_RUNTIME_BRIDGE_ENABLED: "1",
      STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED: "1",
      STAGE1_UNATTENDED_IDEMPOTENCY_KEY: "stage1-bridge-test",
      STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY: "1",
      STAGE1_UNATTENDED_ATTEMPT_LATCH_PATH: "/tmp/stage1-bridge-missing-cache-latch.json",
    },
  });

  const result = await bridge.runOnce();
  assert.equal(adapterCalls, 0);
  assert.equal(result.worker.lastResult.ready, false);
  assert.equal(result.worker.attemptConsumed, false);
});

test("bridge exposes no automatic server integration", () => {
  const bridge = createStage1UnattendedOneShareRuntimeBridge({ env: {} });
  const d = bridge.diagnostics();
  assert.equal(d.safety.automaticStartAllowed, false);
  assert.equal(d.safety.serverIntegrated, false);
  assert.equal(d.safety.liveTradingAllowed, false);
});
