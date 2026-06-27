import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE,
  buildManualMarketHoursPaperAttemptChecklist
} from "../src/scanner/manual_market_hours_paper_attempt_checklist.mjs";

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
  "--checklist-only=true",
  "--preflight-only=true",
  "--no-network-now=true",
  "--no-order-now=true",
  "--borac-final-decision-required=true",
  `--checklist-approval=${REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE}`,
  "--reason=Manual market hours checklist only before exactly one paper broker network call attempt"
];

test("manual market-hours checklist is blocked by default and attempts nothing", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-market-checklist-default-"));

  const report = buildManualMarketHoursPaperAttemptChecklist({
    argv: [],
    env: {},
    runsDir,
    now: new Date("2026-06-27T05:45:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.checklistReady, false);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.deepEqual(report.checklistCommands, []);
  assert.equal(report.finalNetworkCommandIncluded, false);
  assert.ok(report.blockers.includes("final_runbook_not_ready"));
  assert.ok(report.blockers.includes("exact_manual_checklist_approval_phrase_required"));
});

test("manual market-hours checklist emits only validation and preflight commands when ready", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-market-checklist-ready-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildManualMarketHoursPaperAttemptChecklist({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "checklist_ready");
  assert.equal(report.checklistReady, true);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.finalNetworkCommandIncluded, false);
  assert.equal(report.finalNetworkCommandWithheld, true);
  assert.equal(report.checklistCommands.length, 4);
  assert.match(report.checklistCommands[2].command, /preflight:paper-broker-runtime-env/);
  assert.doesNotMatch(JSON.stringify(report.checklistCommands), /network:paper-broker-call/);
  assert.deepEqual(report.blockers, []);
});

test("manual market-hours checklist blocks missing checklist-only flags", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-market-checklist-flags-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildManualMarketHoursPaperAttemptChecklist({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      `--checklist-approval=${REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE}`,
      "--reason=Manual market hours checklist only before exactly one paper broker network call attempt"
    ],
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("checklist_only_flag_required"));
  assert.ok(report.blockers.includes("preflight_only_flag_required"));
  assert.ok(report.blockers.includes("no_network_now_flag_required"));
  assert.ok(report.blockers.includes("no_order_now_flag_required"));
  assert.ok(report.blockers.includes("borac_final_decision_required_flag_required"));
  assert.equal(report.orderSubmitted, false);
});

test("manual market-hours checklist blocks outside market hours through runbook", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-market-checklist-closed-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildManualMarketHoursPaperAttemptChecklist({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-27T05:45:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("final_runbook_not_ready"));
  assert.equal(report.orderSubmitted, false);
});
