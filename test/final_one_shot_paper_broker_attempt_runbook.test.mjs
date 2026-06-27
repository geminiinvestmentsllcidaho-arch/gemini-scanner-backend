import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE,
  buildFinalOneShotPaperBrokerAttemptRunbook
} from "../src/scanner/final_one_shot_paper_broker_attempt_runbook.mjs";

function writeApprovedImplementationRecord(runsDir) {
  const record = {
    ok: true,
    version: "separate_explicit_paper_broker_network_implementation_approval_v1",
    ts: "2026-06-26T14:00:00.000Z",
    approvalScope: "separate_paper_broker_network_implementation_patch_only",
    status: "approved_for_separate_patch_only",
    approvalGrantedForSeparatePatchOnly: true,
    implementationIncluded: false,
    networkCodeIncludedNow: false,
    networkCallImplemented: false,
    endpointImplemented: false,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: {
      symbol: "AAPL",
      qty: 1,
      side: "buy",
      type: "market",
      timeInForce: "day"
    },
    safety: {
      approvalRecordOnly: true,
      separatePatchOnly: true,
      implementationIncluded: false,
      networkCodeIncludedNow: false,
      networkCallImplemented: false,
      endpointImplemented: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers: []
  };

  const file = join(
    runsDir,
    "separate_explicit_paper_broker_network_implementation_approval_approved_2026-06-26T14-00-00-000Z.json"
  );

  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}

const goodEnv = {
  ALPACA_PAPER_TRADING_BASE_URL: "https://paper.example.test",
  ALPACA_PAPER_ORDER_CREATE_PATH: "/paper-only-test-route",
  ALPACA_API_KEY_ID: "KEY123456",
  ALPACA_API_SECRET_KEY: "SECRET123456"
};

const goodArgs = [
  "--by=Borac",
  "--symbol=AAPL",
  "--qty=1",
  "--side=buy",
  "--type=market",
  "--tif=day",
  "--runbook-only=true",
  "--no-network-now=true",
  "--no-order-now=true",
  "--final-manual-review=true",
  `--runbook-approval=${REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE}`,
  "--reason=Final runbook only before exactly one paper broker network call attempt"
];

test("final one-shot runbook is blocked by default and attempts nothing", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-runbook-default-"));

  const report = buildFinalOneShotPaperBrokerAttemptRunbook({
    argv: [],
    env: {},
    runsDir,
    now: new Date("2026-06-27T05:40:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.runbookReady, false);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.deepEqual(report.commandSequence, []);
  assert.ok(report.blockers.includes("runtime_preflight_not_ready"));
  assert.ok(report.blockers.includes("exact_final_runbook_approval_phrase_required"));
});

test("final one-shot runbook emits command sequence only after preflight is ready", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-runbook-ready-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildFinalOneShotPaperBrokerAttemptRunbook({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "runbook_ready");
  assert.equal(report.runbookReady, true);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.commandSequence.length, 4);
  assert.match(report.commandSequence[1].command, /preflight:paper-broker-runtime-env/);
  assert.match(report.commandSequence[2].command, /network:paper-broker-call/);
  assert.match(report.commandSequence[2].command, /--stop-after-single-attempt=true/);
  assert.deepEqual(report.blockers, []);
});

test("final one-shot runbook blocks missing runbook-only flags", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-runbook-flags-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildFinalOneShotPaperBrokerAttemptRunbook({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      `--runbook-approval=${REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE}`,
      "--reason=Final runbook only before exactly one paper broker network call attempt"
    ],
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("runbook_only_flag_required"));
  assert.ok(report.blockers.includes("no_network_now_flag_required"));
  assert.ok(report.blockers.includes("no_order_now_flag_required"));
  assert.ok(report.blockers.includes("final_manual_review_flag_required"));
  assert.equal(report.orderSubmitted, false);
});

test("final one-shot runbook blocks outside market hours through runtime preflight", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-runbook-closed-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildFinalOneShotPaperBrokerAttemptRunbook({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-27T05:40:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("runtime_preflight_not_ready"));
  assert.equal(report.runtimePreflight.status, "blocked");
  assert.equal(report.orderSubmitted, false);
});
