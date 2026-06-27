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
  REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE
} from "../src/scanner/first_tiny_paper_order_final_submit_approval_lock.mjs";

import { buildManualFirstTinyPaperOrderSubmitCommandBuilder } from "../src/scanner/manual_first_tiny_paper_order_submit_command_builder.mjs";

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

test("manual submit command builder is blocked by default and executes nothing", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-command-builder-default-"));

  const report = buildManualFirstTinyPaperOrderSubmitCommandBuilder({
    env: {},
    argv: [],
    runsDir,
    now: new Date("2026-06-27T05:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.commandPreviewAllowed, false);
  assert.equal(report.commandPreview, null);
  assert.equal(report.safety.commandExecuted, false);
  assert.equal(report.safety.orderSubmitAttempted, false);
  assert.equal(report.safety.orderSubmitted, false);
  assert.ok(report.blockers.includes("final_submit_lock_not_unlocked"));
});

test("manual submit command builder shows command only after final lock unlocks", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-command-builder-ready-"));
  writeApprovedRecord(runsDir);

  const report = buildManualFirstTinyPaperOrderSubmitCommandBuilder({
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

  assert.equal(report.status, "command_preview_ready");
  assert.equal(report.commandPreviewAllowed, true);
  assert.match(report.commandPreview, /npm run submit:first-tiny-paper-order-manual --/);
  assert.match(report.commandPreview, /--symbol=AAPL/);
  assert.match(report.commandPreview, /--qty=1/);
  assert.match(report.commandPreview, /--paper-only=true/);
  assert.match(report.commandPreview, /--manual-only=true/);
  assert.match(report.commandPreview, /--no-auto-submit=true/);
  assert.equal(report.safety.commandExecuted, false);
  assert.equal(report.safety.brokerContactAttempted, false);
  assert.equal(report.safety.orderSubmitAttempted, false);
  assert.equal(report.safety.orderSubmitted, false);
});

test("manual submit command builder refuses quantity above one share", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-command-builder-qty-block-"));
  writeApprovedRecord(runsDir);

  const report = buildManualFirstTinyPaperOrderSubmitCommandBuilder({
    env: passingEnv,
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=2",
      "--side=buy",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE}`,
      "--reason=Final manual unlock approval for first tiny paper order submit path only"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.commandPreviewAllowed, false);
  assert.equal(report.commandPreview, null);
  assert.ok(report.blockers.includes("tiny_order_quantity_exceeds_one_share"));
  assert.equal(report.safety.orderSubmitted, false);
});
