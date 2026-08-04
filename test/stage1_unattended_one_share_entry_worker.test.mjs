import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStage1UnattendedOneShareEntryWorker } from "../src/scanner/stage1_unattended_one_share_entry_worker.mjs";

const nowMs = Date.parse("2026-08-03T20:00:00.000Z");
const latchFile = () => join(mkdtempSync(join(tmpdir(), "gs-stage1-worker-")), "attempt.json");
const snapshot = {
  ok: true,
  marketClock: { isOpen: true, timestamp: "2026-08-03T19:59:30.000Z" },
  candidates: [
    { symbol: "BBB", state: "ENTER", buyRecommendation: true, blocked: false, blockers: [], spreadPct: 0.4, sourceAgeSec: 5, score: 75 },
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

test("worker is disabled by default and never invokes adapter", async () => {
  let calls = 0;
  const worker = createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => account,
    adapter: async () => { calls += 1; },
    now: () => nowMs,
    attemptLatchPath: latchFile(),
    env: {},
  });
  const result = await worker.runOnce();
  assert.equal(calls, 0);
  assert.equal(result.lastResult.status, "DISABLED_BY_ENV");
  assert.equal(result.safety.disabledByDefault, true);
});

test("enabled worker selects strongest ENTER and submits exactly once", async () => {
  let calls = 0;
  const worker = createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => account,
    adapter: async (order, context) => {
      calls += 1;
      assert.equal(order.symbol, "AAA");
      assert.equal(order.qty, 1);
      assert.equal(order.paperOnly, true);
      assert.equal(context.idempotencyKey, "stage1-proof-1");
      return { networkAttempted: true, orderSubmitAttempted: true, orderSubmitted: true };
    },
    now: () => nowMs,
    attemptLatchPath: latchFile(),
    env: {
      STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED: "1",
      STAGE1_UNATTENDED_IDEMPOTENCY_KEY: "stage1-proof-1",
      STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY: "1",
    },
  });

  const first = await worker.runOnce();
  const second = await worker.runOnce();
  assert.equal(calls, 1);
  assert.equal(first.attemptConsumed, true);
  assert.equal(first.lastResult.orderSubmitted, true);
  assert.equal(second.lastResult.status, "ONE_SHOT_ALREADY_CONSUMED");
});

test("worker blocks when account baseline is not empty", async () => {
  let calls = 0;
  const worker = createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => ({ ...account, positions: [{ symbol: "OLD", qty: 1 }] }),
    adapter: async () => { calls += 1; },
    now: () => nowMs,
    attemptLatchPath: latchFile(),
    env: {
      STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED: "1",
      STAGE1_UNATTENDED_IDEMPOTENCY_KEY: "stage1-proof-2",
      STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY: "1",
    },
  });
  const result = await worker.runOnce();
  assert.equal(calls, 0);
  assert.ok(result.lastResult.blockers.includes("zero_position_baseline_required"));
  assert.equal(result.attemptConsumed, false);
});

test("worker consumes one-shot after adapter attempt even when broker rejects", async () => {
  let calls = 0;
  const worker = createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => account,
    adapter: async () => {
      calls += 1;
      return { networkAttempted: true, orderSubmitAttempted: true, orderSubmitted: false };
    },
    now: () => nowMs,
    attemptLatchPath: latchFile(),
    env: {
      STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED: "1",
      STAGE1_UNATTENDED_IDEMPOTENCY_KEY: "stage1-proof-3",
      STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY: "1",
    },
  });
  const first = await worker.runOnce();
  await worker.runOnce();
  assert.equal(calls, 1);
  assert.equal(first.attemptConsumed, true);
  assert.equal(first.lastResult.status, "ONE_UNATTENDED_PAPER_SHARE_ATTEMPT_COMPLETED");
});


test("worker blocks enabled execution when durable latch path is missing", async () => {
  let calls = 0;
  const worker = createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => account,
    adapter: async () => { calls += 1; },
    now: () => nowMs,
    env: {
      STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED: "1",
      STAGE1_UNATTENDED_IDEMPOTENCY_KEY: "stage1-proof-4",
      STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY: "1",
    },
  });
  const result = await worker.runOnce();
  assert.equal(calls, 0);
  assert.equal(result.lastResult.status, "BLOCKED_DURABLE_LATCH_REQUIRED");
  assert.equal(result.inFlight, false);
});

test("durable latch prevents a second worker instance from attempting", async () => {
  let calls = 0;
  const file = latchFile();
  const build = () => createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => account,
    adapter: async () => {
      calls += 1;
      return { networkAttempted: true, orderSubmitAttempted: true, orderSubmitted: false };
    },
    now: () => nowMs,
    attemptLatchPath: file,
    env: {
      STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED: "1",
      STAGE1_UNATTENDED_IDEMPOTENCY_KEY: "stage1-proof-5",
      STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY: "1",
    },
  });
  const first = await build().runOnce();
  const second = await build().runOnce();
  assert.equal(calls, 1);
  assert.equal(first.attemptConsumed, true);
  assert.equal(first.inFlight, false);
  assert.equal(second.attemptConsumed, true);
  assert.equal(second.lastResult.status, "ONE_SHOT_ALREADY_CONSUMED");
});


const enabledEnv = {
  STAGE1_UNATTENDED_PAPER_ENTRY_ENABLED: "1",
  STAGE1_UNATTENDED_IDEMPOTENCY_KEY: "stage1-worker-throw-proof",
  STAGE1_UNATTENDED_KILL_SWITCH_HEALTHY: "1",
};

test("worker consumes durable one-shot before adapter throws", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stage1-worker-throw-"));
  const latchPath = join(dir, "attempt.json");
  let calls = 0;
  const worker = createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => account,
    adapter: async () => {
      calls += 1;
      throw new Error("ambiguous network failure");
    },
    now: () => nowMs,
    attemptLatchPath: latchPath,
    env: enabledEnv,
  });

  const first = await worker.runOnce();
  assert.equal(calls, 1);
  assert.equal(first.inFlight, false);
  assert.equal(first.attemptConsumed, true);
  assert.equal(first.lastResult.status, "WORKER_ERROR");

  const second = await worker.runOnce();
  assert.equal(calls, 1);
  assert.equal(second.attemptConsumed, true);
  assert.equal(second.lastResult.status, "ONE_SHOT_ALREADY_CONSUMED");
});

test("durable latch blocks restart after adapter throws", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stage1-worker-throw-restart-"));
  const latchPath = join(dir, "attempt.json");
  let calls = 0;
  const options = {
    getScanSnapshot: async () => snapshot,
    fetchAccountSnapshot: async () => account,
    adapter: async () => {
      calls += 1;
      throw new Error("timeout after dispatch boundary");
    },
    now: () => nowMs,
    attemptLatchPath: latchPath,
    env: enabledEnv,
  };

  await createStage1UnattendedOneShareEntryWorker(options).runOnce();
  const restarted = await createStage1UnattendedOneShareEntryWorker(options).runOnce();

  assert.equal(calls, 1);
  assert.equal(restarted.attemptConsumed, true);
  assert.notEqual(restarted.lastResult.status, "WORKER_ERROR");
});
