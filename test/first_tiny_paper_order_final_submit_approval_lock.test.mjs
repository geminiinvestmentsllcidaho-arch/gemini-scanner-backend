import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE,
  buildFirstTinyPaperOrderApprovalRecord
} from "../src/scanner/first_tiny_paper_order_approval_record.mjs";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE,
  buildFirstTinyPaperOrderFinalSubmitApprovalLock
} from "../src/scanner/first_tiny_paper_order_final_submit_approval_lock.mjs";

function writeApprovedRecord(runsDir) {
  const record = buildFirstTinyPaperOrderApprovalRecord({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE}`,
      "--reason=Controlled first tiny paper order preflight approval only"
    ],
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  const stamp = record.ts.replace(/[:.]/g, "-");
  const file = join(runsDir, `first_tiny_paper_order_approval_record_approved_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}

const passingEnv = {
  BORAC_TINY_PAPER_ORDER_PREFLIGHT_APPROVAL: "I_APPROVE_FIRST_TINY_PAPER_ORDER_PREFLIGHT",
  PAPER_TRADING_KILL_SWITCH: "false",
  BROKER_ADAPTER_ENABLED: "true",
  BROKER_ADAPTER_REQUESTED: "true",
  PAPER_ORDER_SUBMIT_ENABLED: "true",
  BROKER_ADAPTER_APPROVAL_LOCK_PASSED: "true"
};

test("final submit approval lock is blocked by default and cannot submit", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-lock-default-"));

  const report = buildFirstTinyPaperOrderFinalSubmitApprovalLock({
    env: {},
    argv: [],
    runsDir,
    now: new Date("2026-06-27T04:55:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.lockStatus, "locked");
  assert.equal(report.submitPathUnlocked, false);
  assert.equal(report.safety.orderSubmitAttempted, false);
  assert.equal(report.safety.orderSubmitted, false);
  assert.ok(report.blockers.includes("exact_final_submit_approval_phrase_required"));
  assert.ok(report.blockers.includes("submit_preflight_gate_not_clean"));
});

test("final submit approval lock unlocks only after clean gate and exact Borac approval", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-lock-unlock-"));
  writeApprovedRecord(runsDir);

  const report = buildFirstTinyPaperOrderFinalSubmitApprovalLock({
    env: passingEnv,
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE}`,
      "--reason=Final manual unlock approval for first tiny paper order submit path only"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.submitPathUnlocked, true);
  assert.equal(report.lockStatus, "unlocked");
  assert.equal(report.status, "unlocked_for_manual_submit_step_only");
  assert.deepEqual(report.blockers, []);
  assert.equal(report.safety.unlockOnly, true);
  assert.equal(report.safety.brokerContactAttempted, false);
  assert.equal(report.safety.orderSubmitAttempted, false);
  assert.equal(report.safety.orderSubmitted, false);
  assert.equal(report.gate.readyForSeparateSubmitApproval, true);
});

test("final submit approval lock stays locked when preflight gate has issue blockers", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-lock-gate-blocked-"));
  writeApprovedRecord(runsDir);

  const report = buildFirstTinyPaperOrderFinalSubmitApprovalLock({
    env: { ...passingEnv, PAPER_TRADING_KILL_SWITCH: "true" },
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE}`,
      "--reason=Final manual unlock approval for first tiny paper order submit path only"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.submitPathUnlocked, false);
  assert.equal(report.lockStatus, "locked");
  assert.ok(report.blockers.includes("submit_preflight_gate_not_clean"));
  assert.ok(report.blockers.includes("submit_preflight_issue_blockers_present"));
  assert.equal(report.safety.orderSubmitted, false);
});
