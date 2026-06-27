import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE,
  buildSeparateExplicitPaperBrokerNetworkImplementationApproval
} from "../src/scanner/separate_explicit_paper_broker_network_implementation_approval.mjs";

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

test("separate implementation approval is blocked by default and includes no implementation", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-approval-default-"));

  const report = buildSeparateExplicitPaperBrokerNetworkImplementationApproval({
    argv: [],
    runsDir,
    now: new Date("2026-06-27T05:25:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.approvalGrantedForSeparatePatchOnly, false);
  assert.equal(report.implementationIncluded, false);
  assert.equal(report.networkCodeIncludedNow, false);
  assert.equal(report.networkCallImplemented, false);
  assert.equal(report.endpointImplemented, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("decision_gate_not_ready_for_separate_implementation_stage"));
  assert.ok(report.blockers.includes("exact_network_implementation_approval_phrase_required"));
});

test("separate implementation approval grants only future patch permission after full chain passes", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-approval-ready-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildSeparateExplicitPaperBrokerNetworkImplementationApproval({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--approval-record-only=true",
      "--separate-patch-only=true",
      "--no-network-code-now=true",
      "--no-broker-contact-now=true",
      "--no-order-attempt-now=true",
      `--approval=${REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE}`,
      "--reason=Approval record only for a separate paper broker network implementation patch"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "approved_for_separate_patch_only");
  assert.equal(report.approvalGrantedForSeparatePatchOnly, true);
  assert.equal(report.implementationIncluded, false);
  assert.equal(report.networkCodeIncludedNow, false);
  assert.equal(report.networkCallImplemented, false);
  assert.equal(report.endpointImplemented, false);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.nextPatchContract.mayAddNetworkCodeInSeparatePatch, true);
  assert.deepEqual(report.blockers, []);
});

test("separate implementation approval blocks missing isolation flags", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-approval-flags-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildSeparateExplicitPaperBrokerNetworkImplementationApproval({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      `--approval=${REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE}`,
      "--reason=Approval record only for a separate paper broker network implementation patch"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("approval_record_only_flag_required"));
  assert.ok(report.blockers.includes("separate_patch_only_flag_required"));
  assert.ok(report.blockers.includes("no_network_code_now_flag_required"));
  assert.ok(report.blockers.includes("no_broker_contact_now_flag_required"));
  assert.ok(report.blockers.includes("no_order_attempt_now_flag_required"));
  assert.equal(report.orderSubmitted, false);
});

test("separate implementation approval blocks outside market hours through decision chain", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-approval-closed-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildSeparateExplicitPaperBrokerNetworkImplementationApproval({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--approval-record-only=true",
      "--separate-patch-only=true",
      "--no-network-code-now=true",
      "--no-broker-contact-now=true",
      "--no-order-attempt-now=true",
      `--approval=${REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE}`,
      "--reason=Approval record only for a separate paper broker network implementation patch"
    ],
    runsDir,
    now: new Date("2026-06-27T05:25:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("decision_gate_not_ready_for_separate_implementation_stage"));
  assert.equal(report.networkCallImplemented, false);
  assert.equal(report.orderSubmitted, false);
});
