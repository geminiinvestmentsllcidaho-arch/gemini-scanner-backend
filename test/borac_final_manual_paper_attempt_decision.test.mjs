import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_PHRASE,
  buildBoracFinalManualPaperAttemptDecision
} from "../src/scanner/borac_final_manual_paper_attempt_decision.mjs";

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
  "--decision-only=true",
  "--show-command-only=true",
  "--manual-execution-only=true",
  "--no-auto-run=true",
  "--borac-accepts-paper-risk=true",
  `--final-decision-approval=${REQUIRED_BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_PHRASE}`,
  "--reason=Final manual decision only before exactly one paper broker network call attempt"
];

test("Borac final manual paper attempt decision is blocked by default and executes nothing", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-decision-default-"));

  const report = buildBoracFinalManualPaperAttemptDecision({
    argv: [],
    env: {},
    runsDir,
    now: new Date("2026-06-27T05:50:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.finalCommandVisible, false);
  assert.equal(report.finalManualCommand, null);
  assert.equal(report.commandAutoExecuted, false);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("manual_market_hours_checklist_not_ready"));
  assert.ok(report.blockers.includes("exact_final_decision_approval_phrase_required"));
});

test("Borac final manual paper attempt decision displays final command only after all controls pass", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-decision-visible-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildBoracFinalManualPaperAttemptDecision({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "final_command_visible_for_manual_copy_only");
  assert.equal(report.finalCommandVisible, true);
  assert.match(report.finalManualCommand, /network:paper-broker-call/);
  assert.match(report.finalManualCommand, /--execute-network=true/);
  assert.match(report.finalManualCommand, /--stop-after-single-attempt=true/);
  assert.equal(report.commandAutoExecuted, false);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.deepEqual(report.blockers, []);
});

test("Borac final manual paper attempt decision blocks missing decision flags", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-decision-flags-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildBoracFinalManualPaperAttemptDecision({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      `--final-decision-approval=${REQUIRED_BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_PHRASE}`,
      "--reason=Final manual decision only before exactly one paper broker network call attempt"
    ],
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("decision_only_flag_required"));
  assert.ok(report.blockers.includes("show_command_only_flag_required"));
  assert.ok(report.blockers.includes("manual_execution_only_flag_required"));
  assert.ok(report.blockers.includes("no_auto_run_flag_required"));
  assert.ok(report.blockers.includes("borac_accepts_paper_risk_flag_required"));
  assert.equal(report.orderSubmitted, false);
});

test("Borac final manual paper attempt decision blocks outside market hours through checklist", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-final-decision-closed-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildBoracFinalManualPaperAttemptDecision({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-27T05:50:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("manual_market_hours_checklist_not_ready"));
  assert.equal(report.finalManualCommand, null);
  assert.equal(report.orderSubmitted, false);
});
