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

test("enabled wrapper maps locked order to executor options once", async () => {
  let calls = 0;
  let captured = null;
  const requestFn = async () => ({});
  const wrapper = createStage1UnattendedOneShareExecutorWrapper({
    env: enabledEnv,
    runsDir: "/tmp/stage1-wrapper-test",
    requestFn,
    now: () => new Date("2026-08-03T18:00:00.000Z"),
    runExecutor: async (options) => {
      calls += 1;
      captured = options;
      return {
        ok: true,
        runStatus: "network_attempt_completed",
        brokerContactAttempted: true,
        orderSubmitAttempted: true,
        orderSubmitted: false,
        blockers: [],
      };
    },
  });
  const result = await wrapper.executePaperOrder(order, context);
  assert.equal(calls, 1);
  assert.equal(captured.requestFn, requestFn);
  assert.equal(captured.runsDir, "/tmp/stage1-wrapper-test");
  assert.ok(captured.argv.includes("--symbol=AAPL"));
  assert.ok(captured.argv.includes("--qty=1"));
  assert.ok(captured.argv.includes(`--runtime-approval=${REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE}`));
  assert.equal(result.networkAttempted, true);
  assert.equal(result.orderSubmitAttempted, true);
  assert.equal(result.orderSubmitted, false);
});
