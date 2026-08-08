import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  VERSION,
  buildPaperBrokerNetworkAttemptStatusAppScreen,
  renderPaperBrokerNetworkAttemptStatusAppScreenHtml
} from "../src/scanner/paper_broker_network_attempt_status_app_screen.mjs";

function tempRunsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-network-attempt-app-"));
}

function writePostAttempt(runsDir, overrides = {}) {
  const file = path.join(
    runsDir,
    "paper_broker_network_call_post_attempt_2026-07-01T16-32-01-459Z.json"
  );
  const report = {
    ok: true,
    version: "paper_broker_network_call_implementation_patch_v1",
    ts: "2026-07-01T16:32:01.459Z",
    status: "ready_for_single_paper_network_attempt",
    runStatus: "network_attempt_completed",
    readyForSinglePaperNetworkAttempt: true,
    approvalRecordFile: "runs/separate_explicit_paper_broker_network_implementation_approval_approved_2026-07-01T16-06-45-832Z.json",
    brokerAdapterCallAttempted: true,
    brokerContactAttempted: true,
    orderSubmitAttempted: true,
    orderSubmitted: true,
    accountMutationAttempted: false,
    preAttemptAuditFile: "runs/paper_broker_network_call_pre_attempt_2026-07-01T16-31-59-780Z.json",
    postAttemptAuditFile: file,
    parameters: { symbol: "AAPL", qty: 1, side: "buy", type: "market", timeInForce: "day" },
    session: { weekday: "Wed", hour: 12, minute: 32, marketOpen: true },
    approval: {
      approvalRecordFound: true,
      approvalRecordFile: "runs/separate_explicit_paper_broker_network_implementation_approval_approved_2026-07-01T16-06-45-832Z.json"
    },
    response: { ok: true, status: 200, statusText: "OK", bodyPreview: "{\"id\":\"paper-test-order\"}" },
    safety: {
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerAdapterCallAttempted: true,
      brokerContactAttempted: true,
      orderSubmitAttempted: true,
      orderSubmitted: true,
      accountMutationAttempted: false
    },
    blockers: [],
    ...overrides
  };
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

test("paper broker network attempt status app screen renders latest attempt safely", () => {
  const runsDir = tempRunsDir();
  const file = writePostAttempt(runsDir);

  const screen = buildPaperBrokerNetworkAttemptStatusAppScreen({ runsDir });
  assert.equal(VERSION, "paper_broker_network_attempt_status_app_screen_v1");
  assert.equal(screen.ok, true);
  assert.equal(screen.version, VERSION);
  assert.equal(screen.route, "/app/paper-broker-network-attempt-status");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.auditOnly, true);
  assert.equal(screen.paperOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.noResetControls, true);
  assert.equal(screen.reportFound, true);
  assert.equal(screen.latestPostAttemptFile, file);
  assert.equal(screen.status, "network_attempt_completed");
  assert.equal(screen.sourceStatus, "ready_for_single_paper_network_attempt");
  assert.equal(screen.readyForSinglePaperNetworkAttempt, true);
  assert.equal(screen.brokerContactAttempted, true);
  assert.equal(screen.orderSubmitAttempted, true);
  assert.equal(screen.orderSubmitted, true);
  assert.equal(screen.accountMutationAttempted, false);
  assert.equal(screen.response.ok, true);
  assert.equal(screen.response.status, 200);
  assert.equal(screen.parameters.symbol, "AAPL");
  assert.equal(screen.safety.liveTradingAllowed, false);
  assert.equal(screen.safety.autoTradingAllowed, false);
  assert.equal(screen.safety.accountMutationAllowed, false);

  const html = renderPaperBrokerNetworkAttemptStatusAppScreenHtml(screen);
  assert.equal(html.includes("Paper Broker Network Attempt Status"), true);
  assert.equal(html.includes("No retry, no new broker contact, no order submit, no account mutation, no reset controls."), true);
  assert.equal(html.includes("Related broker readiness routes"), true);
  assert.equal(html.includes("/app/paper-app-broker-readiness-index"), true);
  assert.equal(html.includes("/app/paper-broker-runtime-environment-preflight"), true);
  assert.equal(html.includes("/app/paper-readiness-gate"), true);
  assert.equal(html.includes("network_attempt_completed"), true);
  assert.equal(html.includes("paper-test-order"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
  assert.equal(/type=["']submit["']/i.test(html), false);
});

test("paper broker network attempt status app screen handles missing report safely", () => {
  const runsDir = tempRunsDir();
  const screen = buildPaperBrokerNetworkAttemptStatusAppScreen({ runsDir });

  assert.equal(screen.ok, true);
  assert.equal(screen.reportFound, false);
  assert.equal(screen.status, "no_network_attempt_record");
  assert.equal(screen.readyForSinglePaperNetworkAttempt, false);
  assert.equal(screen.brokerContactAttempted, false);
  assert.equal(screen.orderSubmitAttempted, false);
  assert.equal(screen.orderSubmitted, false);
  assert.equal(screen.accountMutationAttempted, false);
  assert.deepEqual(screen.blockers, ["network_attempt_record_missing"]);
  assert.equal(screen.safety.paperOnly, true);
  assert.equal(screen.safety.liveTradingAllowed, false);
  assert.equal(screen.safety.autoTradingAllowed, false);
  assert.equal(screen.safety.accountMutationAllowed, false);

  const html = renderPaperBrokerNetworkAttemptStatusAppScreenHtml(screen);
  assert.equal(html.includes("no_network_attempt_record"), true);
  assert.equal(html.includes("network_attempt_record_missing"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
});
