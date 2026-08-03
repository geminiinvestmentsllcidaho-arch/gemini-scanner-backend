import test from "node:test";
import assert from "node:assert/strict";
import { createStage1UnattendedOneSharePaperAdapter } from "../src/scanner/stage1_unattended_one_share_paper_adapter.mjs";

const order = { symbol: "AAA", qty: 1, side: "buy", type: "market", timeInForce: "day", paperOnly: true };
const context = { idempotencyKey: "stage1-adapter-proof", mode: "stage1_unattended_mechanical_proof", stopAfterSingleAttempt: true };

test("adapter is disabled by default and never invokes executor", async () => {
  let calls = 0;
  const built = createStage1UnattendedOneSharePaperAdapter({ executePaperOrder: async () => { calls += 1; }, env: {} });
  const result = await built.adapter(order, context);
  assert.equal(calls, 0);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("stage1_unattended_paper_adapter_disabled"));
  assert.equal(built.diagnostics().safety.serverIntegrated, false);
});

test("adapter rejects any order outside the one-share paper buy market day envelope", async () => {
  let calls = 0;
  const built = createStage1UnattendedOneSharePaperAdapter({
    executePaperOrder: async () => { calls += 1; },
    env: { STAGE1_UNATTENDED_PAPER_ADAPTER_ENABLED: "1" },
  });
  const result = await built.adapter({ ...order, qty: 2, paperOnly: false }, context);
  assert.equal(calls, 0);
  assert.ok(result.blockers.includes("paper_only_order_required"));
  assert.ok(result.blockers.includes("quantity_must_equal_one"));
});

test("enabled adapter invokes executor once with locked paper order", async () => {
  let calls = 0;
  const built = createStage1UnattendedOneSharePaperAdapter({
    executePaperOrder: async (submitted, submittedContext) => {
      calls += 1;
      assert.deepEqual(submitted, order);
      assert.equal(submittedContext.idempotencyKey, context.idempotencyKey);
      return { ok: true, networkAttempted: true, orderSubmitAttempted: true, orderSubmitted: false };
    },
    env: { STAGE1_UNATTENDED_PAPER_ADAPTER_ENABLED: "1" },
  });
  const result = await built.adapter(order, context);
  assert.equal(calls, 1);
  assert.equal(result.status, "PAPER_ORDER_ATTEMPT_COMPLETED");
  assert.equal(result.networkAttempted, true);
  assert.equal(result.orderSubmitAttempted, true);
  assert.equal(result.orderSubmitted, false);
});
