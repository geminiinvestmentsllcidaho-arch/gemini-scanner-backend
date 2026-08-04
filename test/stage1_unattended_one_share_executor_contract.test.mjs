import test from "node:test";
import assert from "node:assert/strict";
import { createStage1UnattendedOneShareExecutorContract } from "../src/scanner/stage1_unattended_one_share_executor_contract.mjs";

const order = Object.freeze({
  symbol: "AAPL",
  qty: 1,
  side: "buy",
  type: "market",
  timeInForce: "day",
  paperOnly: true,
});

const context = Object.freeze({
  idempotencyKey: "stage1-contract-test",
  mode: "stage1_unattended_mechanical_proof",
  stopAfterSingleAttempt: true,
});

test("unattended executor contract is disabled by default", async () => {
  let calls = 0;
  const contract = createStage1UnattendedOneShareExecutorContract({
    env: {},
    transport: async () => { calls += 1; return {}; },
  });
  const result = await contract.executePaperOrder(order, context);
  assert.equal(calls, 0);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("stage1_unattended_executor_contract_disabled"));
  assert.equal(result.networkAttempted, false);
  assert.equal(result.orderSubmitAttempted, false);
  assert.equal(result.orderSubmitted, false);
});

test("enabled contract still blocks when unattended transport is absent", async () => {
  const contract = createStage1UnattendedOneShareExecutorContract({
    env: { STAGE1_UNATTENDED_EXECUTOR_CONTRACT_ENABLED: "1" },
  });
  const result = await contract.executePaperOrder(order, context);
  assert.ok(result.blockers.includes("unattended_paper_transport_not_implemented"));
  assert.equal(result.networkAttempted, false);
});

test("enabled contract cannot activate an injected transport without separate authorization", async () => {
  let calls = 0;
  const contract = createStage1UnattendedOneShareExecutorContract({
    env: { STAGE1_UNATTENDED_EXECUTOR_CONTRACT_ENABLED: "1" },
    transport: async () => { calls += 1; return {}; },
  });
  const result = await contract.executePaperOrder(order, context);
  assert.equal(calls, 0);
  assert.deepEqual(result.blockers, ["unattended_paper_transport_activation_not_authorized"]);
  assert.equal(result.orderSubmitted, false);
  assert.equal(contract.diagnostics().safety.manualExecutorReuseAllowed, false);
});

test("exact transport authorization permits one locked transport call", async () => {
  let calls = 0;
  const contract = createStage1UnattendedOneShareExecutorContract({
    env: {
      STAGE1_UNATTENDED_EXECUTOR_CONTRACT_ENABLED: "1",
      STAGE1_UNATTENDED_EXECUTOR_TRANSPORT_APPROVAL:
        "AUTHORIZE EXECUTOR CONTRACT TO CALL EXACTLY ONE LOCKED UNATTENDED PAPER TRANSPORT",
    },
    transport: async (submittedOrder, submittedContext) => {
      calls += 1;
      assert.deepEqual(submittedOrder, order);
      assert.deepEqual(submittedContext, context);
      return {
        ok: true,
        status: "PAPER_ORDER_SUBMITTED",
        blockers: [],
        networkAttempted: true,
        orderSubmitAttempted: true,
        orderSubmitted: true,
      };
    },
  });
  const result = await contract.executePaperOrder(order, context);
  assert.equal(calls, 1);
  assert.equal(result.status, "PAPER_ORDER_SUBMITTED");
  assert.equal(result.networkAttempted, true);
  assert.equal(result.orderSubmitAttempted, true);
  assert.equal(result.orderSubmitted, true);
  assert.equal(contract.diagnostics().transportAuthorized, true);
});
