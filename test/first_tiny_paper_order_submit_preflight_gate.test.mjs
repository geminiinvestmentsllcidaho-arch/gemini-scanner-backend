import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE,
  buildFirstTinyPaperOrderApprovalRecord
} from "../src/scanner/first_tiny_paper_order_approval_record.mjs";

import { buildFirstTinyPaperOrderSubmitPreflightGate } from "../src/scanner/first_tiny_paper_order_submit_preflight_gate.mjs";

function writeApprovedRecord(runsDir, overrides = {}) {
  const record = buildFirstTinyPaperOrderApprovalRecord({
    argv: [
      "--by=Borac",
      `--symbol=${overrides.symbol ?? "AAPL"}`,
      `--qty=${overrides.qty ?? "1"}`,
      `--side=${overrides.side ?? "buy"}`,
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE}`,
      "--reason=Controlled first tiny paper order preflight approval only"
    ],
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  const stamp = record.ts.replace(/[:.]/g, "-");
  const file = join(runsDir, `first_tiny_paper_order_approval_record_approved_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return { record, file };
}

test("submit preflight gate is blocked by default and cannot submit", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-submit-gate-default-"));

  const report = buildFirstTinyPaperOrderSubmitPreflightGate({
    env: {},
    argv: [],
    runsDir,
    now: new Date("2026-06-27T04:50:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.readyForSeparateSubmitApproval, false);
  assert.equal(report.safety.dryRunOnly, true);
  assert.equal(report.safety.orderSubmitAttempted, false);
  assert.equal(report.safety.orderSubmitted, false);
  assert.ok(report.issueBlockers.includes("approved_first_tiny_paper_order_record_missing"));
  assert.ok(report.gateBlockers.includes("separate_borac_submit_approval_required"));
});

test("submit preflight gate becomes ready only for separate approval when all dry-run requirements pass", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-submit-gate-ready-"));
  writeApprovedRecord(runsDir);

  const report = buildFirstTinyPaperOrderSubmitPreflightGate({
    env: {
      BORAC_TINY_PAPER_ORDER_PREFLIGHT_APPROVAL: "I_APPROVE_FIRST_TINY_PAPER_ORDER_PREFLIGHT",
      PAPER_TRADING_KILL_SWITCH: "false",
      BROKER_ADAPTER_ENABLED: "true",
      BROKER_ADAPTER_REQUESTED: "true",
      PAPER_ORDER_SUBMIT_ENABLED: "true",
      BROKER_ADAPTER_APPROVAL_LOCK_PASSED: "true"
    },
    argv: ["--symbol=AAPL", "--qty=1", "--side=buy"],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.readyForSeparateSubmitApproval, true);
  assert.deepEqual(report.issueBlockers, []);
  assert.deepEqual(report.controlledPreflight.unexpectedBlockers, []);
  assert.ok(report.controlledPreflight.blockers.includes("paper_order_submit_dry_run_only"));
  assert.ok(report.gateBlockers.includes("separate_borac_submit_approval_required"));
  assert.equal(report.safety.orderSubmitAttempted, false);
  assert.equal(report.safety.orderSubmitted, false);
});

test("submit preflight gate blocks parameter mismatch", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-submit-gate-mismatch-"));
  writeApprovedRecord(runsDir, { symbol: "AAPL", qty: "1", side: "buy" });

  const report = buildFirstTinyPaperOrderSubmitPreflightGate({
    env: {
      BORAC_TINY_PAPER_ORDER_PREFLIGHT_APPROVAL: "I_APPROVE_FIRST_TINY_PAPER_ORDER_PREFLIGHT",
      PAPER_TRADING_KILL_SWITCH: "false",
      BROKER_ADAPTER_ENABLED: "true",
      BROKER_ADAPTER_REQUESTED: "true",
      PAPER_ORDER_SUBMIT_ENABLED: "true",
      BROKER_ADAPTER_APPROVAL_LOCK_PASSED: "true"
    },
    argv: ["--symbol=MSFT", "--qty=1", "--side=buy"],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.readyForSeparateSubmitApproval, false);
  assert.ok(report.issueBlockers.includes("approval_parameter_mismatch"));
  assert.equal(report.safety.orderSubmitAttempted, false);
  assert.equal(report.safety.orderSubmitted, false);
});
