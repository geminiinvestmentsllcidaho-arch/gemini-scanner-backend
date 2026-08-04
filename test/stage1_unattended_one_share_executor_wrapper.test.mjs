import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE,
} from "../src/scanner/paper_broker_network_call_implementation_patch.mjs";
import { createStage1UnattendedOneShareExecutorWrapper } from "../src/scanner/stage1_unattended_one_share_executor_wrapper.mjs";

const order = Object.freeze({ symbol: "AAPL", qty: 1, side: "buy", type: "market", timeInForce: "day", paperOnly: true });
const context = Object.freeze({ idempotencyKey: "stage1-test", mode: "stage1_unattended_mechanical_proof", stopAfterSingleAttempt: true });
const enabledEnv = {
  STAGE1_UNATTENDED_EXECUTOR_WRAPPER_ENABLED: "1",
  STAGE1_UNATTENDED_RUNTIME_APPROVAL: REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE,
  STAGE1_UNATTENDED_RUNTIME_REASON: "Runtime approval for exactly one unattended paper broker network attempt only",
};

test("executor wrapper is disabled by default and invokes nothing", async () => {
  let calls = 0;
  const wrapper = createStage1UnattendedOneShareExecutorWrapper({
    env: {},
    requestFn: async () => ({}),
    runExecutor: async () => { calls += 1; return {}; },
  });
  const result = await wrapper.executePaperOrder(order, context);
  assert.equal(calls, 0);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("stage1_unattended_executor_wrapper_disabled"));
  assert.equal(wrapper.diagnostics().safety.serverIntegrated, false);
});

test("executor wrapper rejects invalid locked envelope", async () => {
  let calls = 0;
  const wrapper = createStage1UnattendedOneShareExecutorWrapper({
    env: enabledEnv,
    requestFn: async () => ({}),
    runExecutor: async () => { calls += 1; return {}; },
  });
  const result = await wrapper.executePaperOrder({ ...order, qty: 2 }, context);
  assert.equal(calls, 0);
  assert.ok(result.blockers.includes("quantity_must_equal_one"));
});

test("enabled wrapper fails closed because the available executor is manual-only", async () => {
  let calls = 0;
  const wrapper = createStage1UnattendedOneShareExecutorWrapper({
    env: enabledEnv,
    runsDir: "/tmp/stage1-wrapper-test",
    requestFn: async () => ({}),
    now: () => new Date("2026-08-03T18:00:00.000Z"),
    runExecutor: async () => {
      calls += 1;
      return {};
    },
  });
  const result = await wrapper.executePaperOrder(order, context);
  assert.equal(calls, 0);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("manual_only_executor_incompatible_with_unattended_mode"));
  assert.equal(result.networkAttempted, false);
  assert.equal(result.orderSubmitAttempted, false);
  assert.equal(result.orderSubmitted, false);
});
