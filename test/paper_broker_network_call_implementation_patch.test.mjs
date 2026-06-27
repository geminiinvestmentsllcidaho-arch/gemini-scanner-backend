import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE,
  buildPaperBrokerNetworkCallImplementationPatch,
  runPaperBrokerNetworkCallImplementationPatch
} from "../src/scanner/paper_broker_network_call_implementation_patch.mjs";

function writeApprovedImplementationRecord(runsDir, overrides = {}) {
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
      symbol: overrides.symbol ?? "AAPL",
      qty: overrides.qty ?? 1,
      side: overrides.side ?? "buy",
      type: overrides.type ?? "market",
      timeInForce: overrides.timeInForce ?? "day"
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
  return file;
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
  "--execute-network=true",
  "--one-shot=true",
  "--paper-only=true",
  "--manual-only=true",
  "--write-audit=true",
  "--stop-after-single-attempt=true",
  `--runtime-approval=${REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE}`,
  "--reason=Runtime approval for exactly one paper broker network call attempt only"
];

test("paper broker network call implementation is blocked by default and attempts nothing", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-call-default-"));

  const report = buildPaperBrokerNetworkCallImplementationPatch({
    argv: [],
    env: {},
    runsDir,
    now: new Date("2026-06-27T05:30:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.readyForSinglePaperNetworkAttempt, false);
  assert.equal(report.networkCallImplemented, true);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("approved_network_implementation_record_missing"));
  assert.ok(report.blockers.includes("execute_network_flag_required"));
});

test("paper broker network call implementation runs one fake paper request only after all controls pass", async () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-call-ready-"));
  writeApprovedImplementationRecord(runsDir);

  let called = 0;
  const report = await runPaperBrokerNetworkCallImplementationPatch({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z"),
    requestFn: async (url, init) => {
      called += 1;
      assert.match(url, /paper\.example\.test/);
      assert.equal(init.method, "POST");
      assert.match(String(init.body), /AAPL/);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "{\"id\":\"paper-test-order\"}"
      };
    }
  });

  assert.equal(called, 1);
  assert.equal(report.runStatus, "network_attempt_completed");
  assert.equal(report.brokerAdapterCallAttempted, true);
  assert.equal(report.brokerContactAttempted, true);
  assert.equal(report.orderSubmitAttempted, true);
  assert.equal(report.orderSubmitted, true);
  assert.equal(report.accountMutationAttempted, false);
  assert.equal(report.response.ok, true);
  assert.ok(report.preAttemptAuditFile);
  assert.ok(report.postAttemptAuditFile);
});

test("paper broker network call implementation blocks repeated one-shot attempt", async () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-call-repeat-"));
  const approvalFile = writeApprovedImplementationRecord(runsDir);

  writeFileSync(
    join(runsDir, "paper_broker_network_call_post_attempt_existing.json"),
    `${JSON.stringify({ approvalRecordFile: approvalFile, orderSubmitted: true }, null, 2)}\n`
  );

  let called = 0;
  const report = await runPaperBrokerNetworkCallImplementationPatch({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z"),
    requestFn: async () => {
      called += 1;
      return { ok: true, status: 200, text: async () => "{}" };
    }
  });

  assert.equal(called, 0);
  assert.equal(report.runStatus, "blocked_before_network");
  assert.ok(report.blockers.includes("prior_one_shot_attempt_already_recorded"));
  assert.equal(report.orderSubmitted, false);
});

test("paper broker network call implementation blocks outside market hours", async () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-network-call-closed-"));
  writeApprovedImplementationRecord(runsDir);

  let called = 0;
  const report = await runPaperBrokerNetworkCallImplementationPatch({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-27T05:30:00.000Z"),
    requestFn: async () => {
      called += 1;
      return { ok: true, status: 200, text: async () => "{}" };
    }
  });

  assert.equal(called, 0);
  assert.equal(report.runStatus, "blocked_before_network");
  assert.ok(report.blockers.includes("market_open_required"));
  assert.equal(report.orderSubmitted, false);
});
