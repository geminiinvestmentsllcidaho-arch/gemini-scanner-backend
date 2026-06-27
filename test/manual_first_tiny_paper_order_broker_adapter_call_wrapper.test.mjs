import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE,
  buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper
} from "../src/scanner/manual_first_tiny_paper_order_broker_adapter_call_wrapper.mjs";

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

test("broker adapter call wrapper is blocked by default and does not contact broker", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-broker-wrapper-default-"));

  const report = buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper({
    argv: [],
    runsDir,
    now: new Date("2026-06-27T05:10:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.brokerAdapterEnvelopeReady, false);
  assert.equal(report.brokerAdapterCallEnvelope, null);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("dry_run_shell_not_ready"));
  assert.ok(report.blockers.includes("exact_actual_broker_contact_approval_phrase_required"));
});

test("broker adapter call wrapper forms envelope only after final lock, market hours, exact approval", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-broker-wrapper-ready-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--actual-paper-submit-approval=true",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE}`,
      "--reason=Actual paper broker contact attempt approval for first tiny paper order only"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "broker_adapter_call_envelope_ready");
  assert.equal(report.brokerAdapterEnvelopeReady, true);
  assert.equal(report.brokerContactPermittedForNextManualStep, true);
  assert.equal(report.brokerAdapterCallEnvelope.adapter, "alpaca_paper");
  assert.equal(report.brokerAdapterCallEnvelope.payloadPreview.symbol, "AAPL");
  assert.equal(report.brokerAdapterCallEnvelope.payloadPreview.qty, "1");
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.deepEqual(report.blockers, []);
});

test("broker adapter call wrapper blocks outside market hours", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-broker-wrapper-closed-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--actual-paper-submit-approval=true",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE}`,
      "--reason=Actual paper broker contact attempt approval for first tiny paper order only"
    ],
    runsDir,
    now: new Date("2026-06-27T05:10:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("market_open_required"));
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
});

test("broker adapter call wrapper blocks missing explicit actual approval flag", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-broker-wrapper-no-flag-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE}`,
      "--reason=Actual paper broker contact attempt approval for first tiny paper order only"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("actual_paper_submit_approval_flag_required"));
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
});
