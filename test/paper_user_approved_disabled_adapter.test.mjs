import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperUserApprovedDisabledAdapterEnvelope,
  invokePaperUserApprovedDisabledAdapter,
} from "../src/scanner/paper_user_approved_disabled_adapter.mjs";

const readyGate = Object.freeze({
  decision: "READY_FOR_DISABLED_ADAPTER_BUILD_ONLY",
  proposalId: "proposal-123",
  idempotencyKey: "stage2:candidate-1:buy:1",
  executionEnabled: false,
  safety: Object.freeze({
    paperOnly: true,
    brokerContactAllowed: false,
    brokerMutationAllowed: false,
    orderPlacementAllowed: false,
    networkCallAllowed: false,
    stage3Locked: true,
  }),
});

test("builds a null-adapter preview envelope with every execution path disabled", () => {
  const result = buildPaperUserApprovedDisabledAdapterEnvelope(readyGate);
  assert.equal(result.status, "DISABLED_ADAPTER_ENVELOPE_READY");
  assert.equal(result.envelope.adapter, "null_paper_adapter");
  assert.equal(result.envelope.operation, "preview_only");
  assert.equal(result.envelope.executionRequested, false);
  assert.equal(result.envelope.networkRequested, false);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.orderPlacementAllowed, false);
  assert.equal(result.safety.stage3Locked, true);
});

test("fails closed when the prior submission gate is not ready", () => {
  const result = buildPaperUserApprovedDisabledAdapterEnvelope({
    ...readyGate,
    decision: "BLOCKED",
  });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("disabled_submission_gate_not_ready"));
  assert.equal(result.envelope, null);
  assert.equal(result.executionEnabled, false);
});

test("fails closed when any inherited safety lock is opened", () => {
  const result = buildPaperUserApprovedDisabledAdapterEnvelope({
    ...readyGate,
    executionEnabled: true,
    safety: {
      ...readyGate.safety,
      brokerContactAllowed: true,
      orderPlacementAllowed: true,
      networkCallAllowed: true,
      stage3Locked: false,
    },
  });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("execution_must_remain_disabled"));
  assert.ok(result.blockers.includes("broker_contact_must_remain_blocked"));
  assert.ok(result.blockers.includes("order_placement_must_remain_blocked"));
  assert.ok(result.blockers.includes("network_call_must_remain_blocked"));
  assert.ok(result.blockers.includes("stage3_must_remain_locked"));
});

test("never invokes a supplied adapter even with a ready envelope", async () => {
  let calls = 0;
  const result = await invokePaperUserApprovedDisabledAdapter(
    readyGate,
    async () => {
      calls += 1;
      throw new Error("must never run");
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.status, "BLOCKED_BY_DESIGN");
  assert.equal(result.adapterSupplied, true);
  assert.equal(result.adapterInvoked, false);
  assert.equal(result.networkAttempted, false);
  assert.equal(result.brokerContactAttempted, false);
  assert.equal(result.orderPlacementAttempted, false);
  assert.equal(result.executionEnabled, false);
  assert.ok(result.blockers.includes("adapter_invocation_disabled_by_design"));
});

test("empty input remains blocked and non-executing", async () => {
  const result = await invokePaperUserApprovedDisabledAdapter();
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.adapterInvoked, false);
  assert.equal(result.networkAttempted, false);
  assert.equal(result.orderPlacementAttempted, false);
  assert.equal(result.safety.brokerMutationAllowed, false);
});
