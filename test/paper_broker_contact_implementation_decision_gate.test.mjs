import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE,
  buildPaperBrokerContactImplementationDecisionGate
} from "../src/scanner/paper_broker_contact_implementation_decision_gate.mjs";

function writeUnlockedFinalLock(runsDir, overrides = {}) {
  const record = {
    ok: true,
    version: "first_tiny_paper_order_final_submit_approval_lock_v1",
    ts: "2026-06-26T14:00:00.000Z",
    approvalScope: "first_tiny_paper_order_submit_path_unlock_only",
    status: "unlocked_for_manual_submit_step_only",
    lockStatus: "unlocked",
    submitPathUnlocked: true,
    parameters: {
      symbol: overrides.symbol ?? "AAPL",
      qty: overrides.qty ?? 1,
      side: overrides.side ?? "buy",
      type: overrides.type ?? "market",
      timeInForce: overrides.timeInForce ?? "day"
    },
    safety: {
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers: []
  };

  const file = join(runsDir, "first_tiny_paper_order_final_submit_approval_lock_unlocked_2026-06-26T14-00-00-000Z.json");
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

test("paper broker contact implementation decision gate is blocked by default", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-implementation-gate-default-"));

  const report = buildPaperBrokerContactImplementationDecisionGate({
    argv: [],
    runsDir,
    now: new Date("2026-06-27T05:20:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.readyForSeparateImplementationStage, false);
  assert.equal(report.implementationApprovedNow, false);
  assert.equal(report.networkImplementationIncluded, false);
  assert.equal(report.networkCallImplemented, false);
  assert.equal(report.endpointImplemented, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("one_shot_executor_not_armed"));
  assert.ok(report.blockers.includes("exact_implementation_decision_phrase_required"));
});

test("paper broker contact implementation decision gate can approve only a separate future implementation stage", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-implementation-gate-ready-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildPaperBrokerContactImplementationDecisionGate({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--review-only=true",
      "--implementation-decision-only=true",
      "--no-network-implementation=true",
      "--no-broker-contact-now=true",
      `--decision-approval=${REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE}`,
      "--reason=Decision review only for separate paper broker contact implementation stage"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "ready_for_separate_network_implementation_stage");
  assert.equal(report.readyForSeparateImplementationStage, true);
  assert.equal(report.implementationApprovedNow, false);
  assert.equal(report.decision.requiresNewPatch, true);
  assert.equal(report.decision.requiresNewExplicitBoracApproval, true);
  assert.equal(report.networkImplementationIncluded, false);
  assert.equal(report.networkCallImplemented, false);
  assert.equal(report.endpointImplemented, false);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.deepEqual(report.blockers, []);
});

test("paper broker contact implementation decision gate blocks missing review-only flags", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-implementation-gate-flags-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildPaperBrokerContactImplementationDecisionGate({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      `--decision-approval=${REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE}`,
      "--reason=Decision review only for separate paper broker contact implementation stage"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("review_only_flag_required"));
  assert.ok(report.blockers.includes("implementation_decision_only_flag_required"));
  assert.ok(report.blockers.includes("no_network_implementation_flag_required"));
  assert.ok(report.blockers.includes("no_broker_contact_now_flag_required"));
  assert.equal(report.orderSubmitted, false);
});

test("paper broker contact implementation decision gate blocks outside market hours through executor chain", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-implementation-gate-closed-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildPaperBrokerContactImplementationDecisionGate({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--review-only=true",
      "--implementation-decision-only=true",
      "--no-network-implementation=true",
      "--no-broker-contact-now=true",
      `--decision-approval=${REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE}`,
      "--reason=Decision review only for separate paper broker contact implementation stage"
    ],
    runsDir,
    now: new Date("2026-06-27T05:20:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("one_shot_executor_not_armed"));
  assert.equal(report.orderSubmitted, false);
});
