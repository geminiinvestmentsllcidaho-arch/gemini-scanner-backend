import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE,
  buildPaperBrokerRuntimeEnvironmentPreflight
} from "../src/scanner/paper_broker_runtime_environment_preflight.mjs";

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
  "--preflight-only=true",
  "--no-network-attempt=true",
  "--no-order-attempt=true",
  "--no-broker-contact=true",
  `--preflight-approval=${REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE}`,
  "--reason=Runtime environment preflight only before exactly one paper broker network call"
];

test("runtime environment preflight is blocked by default and attempts no network", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-runtime-preflight-default-"));

  const report = buildPaperBrokerRuntimeEnvironmentPreflight({
    argv: [],
    env: {},
    runsDir,
    now: new Date("2026-06-27T05:35:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.runtimeEnvironmentReady, false);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("network_call_implementation_not_ready"));
  assert.ok(report.blockers.includes("alpaca_api_key_missing"));
  assert.ok(report.blockers.includes("exact_runtime_preflight_approval_phrase_required"));
});

test("runtime environment preflight becomes ready only with full chain and env present", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-runtime-preflight-ready-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildPaperBrokerRuntimeEnvironmentPreflight({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "runtime_environment_ready");
  assert.equal(report.runtimeEnvironmentReady, true);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.environment.alpacaApiKeyPresent, true);
  assert.equal(report.environment.alpacaApiSecretPresent, true);
  assert.deepEqual(report.blockers, []);
});

test("runtime environment preflight blocks missing env even when approval chain exists", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-runtime-preflight-env-block-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildPaperBrokerRuntimeEnvironmentPreflight({
    argv: goodArgs,
    env: {},
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("alpaca_paper_trading_base_url_missing"));
  assert.ok(report.blockers.includes("alpaca_paper_route_path_missing"));
  assert.ok(report.blockers.includes("alpaca_api_key_missing"));
  assert.ok(report.blockers.includes("alpaca_api_secret_missing"));
  assert.equal(report.orderSubmitted, false);
});

test("runtime environment preflight blocks outside market hours through implementation readiness", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-runtime-preflight-closed-"));
  writeApprovedImplementationRecord(runsDir);

  const report = buildPaperBrokerRuntimeEnvironmentPreflight({
    argv: goodArgs,
    env: goodEnv,
    runsDir,
    now: new Date("2026-06-27T05:35:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("network_call_implementation_not_ready"));
  assert.equal(report.implementationReadiness.status, "blocked");
  assert.equal(report.orderSubmitted, false);
});
