import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE,
  buildManualFirstTinyPaperOrderOneShotSubmitExecutor
} from "../src/scanner/manual_first_tiny_paper_order_one_shot_submit_executor.mjs";

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

test("one-shot submit executor is blocked by default and attempts nothing", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-one-shot-default-"));

  const report = buildManualFirstTinyPaperOrderOneShotSubmitExecutor({
    argv: [],
    runsDir,
    now: new Date("2026-06-27T05:15:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.executorArmedForManualBrokerContactAttempt, false);
  assert.equal(report.executorEnvelope, null);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("broker_adapter_wrapper_not_ready"));
  assert.ok(report.blockers.includes("exact_one_shot_executor_approval_phrase_required"));
});

test("one-shot submit executor arms shell only after every prior control passes", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-one-shot-armed-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildManualFirstTinyPaperOrderOneShotSubmitExecutor({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--one-shot=true",
      "--paper-only=true",
      "--manual-only=true",
      "--final-arm-only=true",
      "--allow-broker-contact-attempt=true",
      `--executor-approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE}`,
      "--reason=One shot executor shell approval for first tiny paper order only"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "armed_for_manual_broker_contact_attempt_shell_only");
  assert.equal(report.executorArmedForManualBrokerContactAttempt, true);
  assert.equal(report.executorEnvelope.payloadPreview.symbol, "AAPL");
  assert.equal(report.executorEnvelope.payloadPreview.qty, "1");
  assert.equal(report.executorEnvelope.endpointImplemented, false);
  assert.equal(report.executorEnvelope.networkCallImplemented, false);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.deepEqual(report.blockers, []);
});

test("one-shot submit executor blocks outside market hours", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-one-shot-closed-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildManualFirstTinyPaperOrderOneShotSubmitExecutor({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--one-shot=true",
      "--paper-only=true",
      "--manual-only=true",
      "--final-arm-only=true",
      "--allow-broker-contact-attempt=true",
      `--executor-approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE}`,
      "--reason=One shot executor shell approval for first tiny paper order only"
    ],
    runsDir,
    now: new Date("2026-06-27T05:15:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("broker_adapter_wrapper_not_ready"));
  assert.equal(report.orderSubmitted, false);
});

test("one-shot submit executor blocks quantity above one share", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-one-shot-qty-block-"));
  writeUnlockedFinalLock(runsDir, { qty: 2 });

  const report = buildManualFirstTinyPaperOrderOneShotSubmitExecutor({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=2",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--one-shot=true",
      "--paper-only=true",
      "--manual-only=true",
      "--final-arm-only=true",
      "--allow-broker-contact-attempt=true",
      `--executor-approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE}`,
      "--reason=One shot executor shell approval for first tiny paper order only"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("tiny_order_quantity_exceeds_one_share"));
  assert.equal(report.orderSubmitted, false);
});
