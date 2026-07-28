import assert from "node:assert/strict";
import test from "node:test";

import { createPostMarketRuntimeWorker } from "../src/scanner/post_market_runtime_worker.mjs";

function immediatePlan(overrides = {}) {
  return {
    shouldRunNow: true,
    schedulerState: "scan_due",
    nextCycleAt: "2026-07-17T21:15:00.000Z",
    readOnly: true,
    paperOnly: true,
    ...overrides,
  };
}

test("starts automatically and runs one scheduled read-only cycle", async () => {
  let calls = 0;
  let scheduledMs = null;
  const times = [
    new Date("2026-07-17T21:00:00.000Z"),
    new Date("2026-07-17T21:00:01.000Z"),
    new Date("2026-07-17T21:00:01.000Z"),
  ];
  const worker = createPostMarketRuntimeWorker({
    now: () => times.shift() ?? new Date("2026-07-17T21:00:01.000Z"),
    getMarketClock: async () => ({ next_open: "2026-07-20T09:30:00-04:00" }),
    buildPlan: () => immediatePlan(),
    runCycle: async () => {
      calls += 1;
      return { status: "completed_readonly", fingerprint: "abc", duplicateSnapshot: false };
    },
    setTimeoutImpl: (_callback, ms) => {
      scheduledMs = ms;
      return { unref() {} };
    },
    clearTimeoutImpl: () => {},
  });

  worker.start();
  await new Promise((resolve) => setImmediate(resolve));

  const status = worker.getStatus();
  assert.equal(calls, 1);
  assert.equal(status.running, true);
  assert.equal(status.runCount, 1);
  assert.equal(status.lastStatus, "completed_readonly");
  assert.equal(status.previousFingerprint, "abc");
  assert.equal(scheduledMs, 899000);
});


test("exposes top-level customer runtime aliases from the authoritative schedule plan", async () => {
  const scheduled = [];
  const nextCycleAt = "2026-07-20T20:15:00.000Z";
  const worker = createPostMarketRuntimeWorker({
    enabled: true,
    now: () => new Date("2026-07-19T20:00:00.000Z"),
    setTimeoutImpl: (fn, delay) => {
      scheduled.push({ fn, delay });
      return { fn, delay };
    },
    clearTimeoutImpl: () => {},
    planSchedule: async () => ({
      shouldRunNow: false,
      schedulerState: "weekend_sleep",
      nextCycleAt,
    }),
    runCycle: async () => {
      throw new Error("cycle should not run");
    },
  });

  await worker.tick();
  const status = worker.getStatus();

  assert.equal(status.schedulerState, "weekend_sleep");
  assert.equal(status.nextWakeAt, nextCycleAt);
  assert.equal(status.lastPlan.schedulerState, "weekend_sleep");
  assert.equal(status.lastPlan.nextCycleAt, nextCycleAt);
  assert.equal(status.readOnly, true);
  assert.equal(status.orderPlacementAllowed, false);
  assert.equal(scheduled.length, 0);
});

test("sleeps until the next relevant window when no cycle is due", async () => {
  let cycleCalls = 0;
  let scheduledMs = null;
  const worker = createPostMarketRuntimeWorker({
    now: () => new Date("2026-07-19T18:00:00.000Z"),
    getMarketClock: async () => ({ next_open: "2026-07-20T09:30:00-04:00" }),
    buildPlan: () => immediatePlan({
      shouldRunNow: false,
      schedulerState: "weekend_sleep",
      nextCycleAt: "2026-07-20T20:15:00.000Z",
    }),
    runCycle: async () => {
      cycleCalls += 1;
    },
    setTimeoutImpl: (_callback, ms) => {
      scheduledMs = ms;
      return { unref() {} };
    },
    clearTimeoutImpl: () => {},
  });

  worker.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(cycleCalls, 0);
  assert.equal(worker.getStatus().lastStatus, "weekend_sleep");
  assert.equal(scheduledMs, 94500000);
});

test("suppresses overlapping ticks", async () => {
  let release;
  let calls = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const worker = createPostMarketRuntimeWorker({
    now: () => new Date("2026-07-17T21:00:00.000Z"),
    getMarketClock: async () => ({}),
    buildPlan: () => immediatePlan(),
    runCycle: async () => {
      calls += 1;
      await pending;
      return { status: "completed_readonly", fingerprint: "x" };
    },
    setTimeoutImpl: () => ({ unref() {} }),
    clearTimeoutImpl: () => {},
  });

  const first = worker.tick();
  await new Promise((resolve) => setImmediate(resolve));
  const second = await worker.tick();

  assert.equal(calls, 1);
  assert.equal(second.skippedCount, 1);
  assert.equal(second.lastStatus, "in_flight_skipped");

  release();
  await first;
});

test("does not report completion while the after-cycle hook is still in flight", async () => {
  let releaseAfterCycle;
  const pendingAfterCycle = new Promise((resolve) => {
    releaseAfterCycle = resolve;
  });
  const worker = createPostMarketRuntimeWorker({
    now: () => new Date("2026-07-17T21:00:00.000Z"),
    getMarketClock: async () => ({}),
    buildPlan: () => immediatePlan(),
    runCycle: async () => ({
      status: "completed_readonly",
      fingerprint: "phase-safe",
      duplicateSnapshot: false,
    }),
    afterCycle: async () => {
      await pendingAfterCycle;
      return { status: "persisted_readonly" };
    },
    setTimeoutImpl: () => ({ unref() {} }),
    clearTimeoutImpl: () => {},
  });

  const tick = worker.tick();
  await new Promise((resolve) => setImmediate(resolve));

  const duringHook = worker.getStatus();
  assert.equal(duringHook.inFlight, true);
  assert.equal(duringHook.lastStatus, "running_readonly_cycle");
  assert.equal(duringHook.lastCompletedAt, null);
  assert.equal(duringHook.lastResult, null);

  releaseAfterCycle();
  await tick;

  const completed = worker.getStatus();
  assert.equal(completed.inFlight, false);
  assert.equal(completed.lastStatus, "completed_readonly");
  assert.equal(typeof completed.lastCompletedAt, "string");
  assert.equal(completed.lastResult.strategyObservationPersistence.status, "persisted_readonly");
});

test("tracks duplicate snapshot suppression", async () => {
  const worker = createPostMarketRuntimeWorker({
    now: () => new Date("2026-07-17T21:00:00.000Z"),
    getMarketClock: async () => ({}),
    buildPlan: () => immediatePlan(),
    runCycle: async () => ({
      status: "completed_readonly",
      fingerprint: "same",
      duplicateSnapshot: true,
    }),
    setTimeoutImpl: () => ({ unref() {} }),
    clearTimeoutImpl: () => {},
  });

  await worker.tick();
  assert.equal(worker.getStatus().lastStatus, "duplicate_snapshot_suppressed");
});

test("fails closed and keeps execution locks closed", async () => {
  const worker = createPostMarketRuntimeWorker({
    now: () => new Date("2026-07-17T21:00:00.000Z"),
    getMarketClock: async () => {
      throw new Error("clock unavailable");
    },
    setTimeoutImpl: () => ({ unref() {} }),
    clearTimeoutImpl: () => {},
    logger: { error() {} },
  });

  const result = await worker.tick();
  const status = worker.getStatus();

  assert.equal(result.status, "worker_error");
  assert.equal(status.lastStatus, "worker_error");
  for (const key of [
    "automaticLearningAllowed",
    "scannerLogicMutationAllowed",
    "thresholdMutationAllowed",
    "orderPlacementAllowed",
    "brokerContactAllowed",
    "accountMutationAllowed",
  ]) {
    assert.equal(status[key], false);
  }
  assert.equal(status.readOnly, true);
  assert.equal(status.paperOnly, true);
});

test("can be explicitly disabled without scheduling", async () => {
  let scheduled = 0;
  const worker = createPostMarketRuntimeWorker({
    env: { GS_POSTMARKET_WORKER_ENABLED: "false" },
    setTimeoutImpl: () => {
      scheduled += 1;
      return {};
    },
  });

  assert.equal(worker.start().lastStatus, "disabled");
  assert.equal((await worker.tick()).lastStatus, "disabled");
  assert.equal(scheduled, 0);
});


test("runs read-only strategy observation persistence hook after a completed cycle", async () => {
  let hookCalls = 0;
  const worker = createPostMarketRuntimeWorker({
    now: () => new Date("2026-07-17T21:00:00.000Z"),
    getMarketClock: async () => ({}),
    buildPlan: () => immediatePlan(),
    runCycle: async () => ({
      status: "completed_readonly",
      fingerprint: "persist-me",
      duplicateSnapshot: false,
    }),
    afterCycle: async ({ result }) => {
      hookCalls += 1;
      assert.equal(result.fingerprint, "persist-me");
      return Object.freeze({
        version: "strategy_observation_persistence_runner_v1",
        appendedCount: 2,
        readOnly: true,
        paperOnly: true,
        automaticLearningAllowed: false,
        scannerLogicMutationAllowed: false,
        thresholdMutationAllowed: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
      });
    },
    setTimeoutImpl: () => ({ unref() {} }),
    clearTimeoutImpl: () => {},
  });

  const result = await worker.tick();

  assert.equal(hookCalls, 1);
  assert.equal(result.strategyObservationPersistence.appendedCount, 2);
  assert.equal(worker.getStatus().lastResult.strategyObservationPersistence.readOnly, true);
});

test("after-cycle persistence failure does not stop the post-market runtime", async () => {
  const worker = createPostMarketRuntimeWorker({
    now: () => new Date("2026-07-17T21:00:00.000Z"),
    getMarketClock: async () => ({}),
    buildPlan: () => immediatePlan(),
    runCycle: async () => ({
      status: "completed_readonly",
      fingerprint: "safe",
      duplicateSnapshot: false,
    }),
    afterCycle: async () => {
      throw new Error("local persistence unavailable");
    },
    setTimeoutImpl: () => ({ unref() {} }),
    clearTimeoutImpl: () => {},
    logger: { error() {} },
  });

  const result = await worker.tick();
  const persistence = result.strategyObservationPersistence;

  assert.equal(worker.getStatus().lastStatus, "completed_readonly");
  assert.equal(persistence.status, "after_cycle_hook_failed");
  for (const key of [
    "automaticLearningAllowed",
    "scannerLogicMutationAllowed",
    "thresholdMutationAllowed",
    "brokerContactAllowed",
    "orderPlacementAllowed",
    "accountMutationAllowed",
  ]) {
    assert.equal(persistence[key], false);
  }
});
