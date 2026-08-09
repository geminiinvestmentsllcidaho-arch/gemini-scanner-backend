import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  VERSION,
  buildPaperBrokerRuntimeEnvironmentPreflightAppScreen,
  renderPaperBrokerRuntimeEnvironmentPreflightAppScreenHtml
} from "../src/scanner/paper_broker_runtime_environment_preflight_app_screen.mjs";

function tempRunsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-runtime-preflight-app-"));
}

function writeReport(runsDir, report) {
  const file = path.join(
    runsDir,
    "paper_broker_runtime_environment_preflight_blocked_2026-07-05T06-18-23-502Z.json"
  );
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

test("paper broker runtime environment preflight app screen renders latest report safely", () => {
  const runsDir = tempRunsDir();

  writeReport(runsDir, {
    ok: true,
    version: "paper_broker_runtime_environment_preflight_v1",
    ts: "2026-07-05T06:18:23.502Z",
    status: "blocked",
    runtimeEnvironmentReady: false,
    preflightOnly: true,
    parameters: { symbol: "SPY", qty: 1, side: "buy", type: "market", timeInForce: "day" },
    environment: {
      alpacaPaperTradingBaseUrlPresent: true,
      alpacaPaperRoutePathPresent: true,
      alpacaApiKeyPresent: true,
      alpacaApiSecretPresent: true,
      keyPreview: "PKC3...redacted",
      secretPreview: "redacted",
      routePreview: "configured_redacted",
      baseUrlPreview: "configured_redacted"
    },
    implementationReadiness: {
      status: "blocked",
      session: { weekday: "Sun", hour: 2, minute: 18, marketOpen: false },
      blockers: ["market_open_required"]
    },
    safety: {
      paperOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      networkAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers: ["network_call_implementation_not_ready", "network_call_implementation_blockers_present"]
  });

  const screen = buildPaperBrokerRuntimeEnvironmentPreflightAppScreen({ runsDir });

  assert.equal(VERSION, "paper_broker_runtime_environment_preflight_app_screen_v1");
  assert.equal(screen.ok, true);
  assert.equal(screen.version, VERSION);
  assert.equal(screen.route, "/app/paper-broker-runtime-environment-preflight");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.paperOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.reportFound, true);
  assert.equal(screen.status, "blocked");
  assert.equal(screen.runtimeEnvironmentReady, false);
  assert.equal(screen.environment.alpacaPaperTradingBaseUrlPresent, true);
  assert.equal(screen.environment.alpacaPaperRoutePathPresent, true);
  assert.equal(screen.environment.alpacaApiKeyPresent, true);
  assert.equal(screen.environment.alpacaApiSecretPresent, true);
  assert.equal(screen.implementation.marketOpen, false);
  assert.deepEqual(screen.implementation.blockers, ["market_open_required"]);
  assert.equal(screen.safety.liveTradingAllowed, false);
  assert.equal(screen.safety.autoTradingAllowed, false);
  assert.equal(screen.safety.networkAttempted, false);
  assert.equal(screen.safety.brokerContactAttempted, false);
  assert.equal(screen.safety.orderSubmitted, false);
  assert.equal(screen.safety.accountMutationAttempted, false);

  const html = renderPaperBrokerRuntimeEnvironmentPreflightAppScreenHtml({ runsDir });
  assert.equal(html.includes("Paper Broker Runtime Environment Preflight"), true);
  assert.equal(html.includes("No broker contact, no order submit, no account mutation, no execution controls."), true);
  assert.equal(html.includes("Paper base URL"), true);
  assert.equal(html.includes("Related broker readiness routes"), true);
  assert.equal(html.includes("/app/paper-app-broker-readiness-index"), true);
  assert.equal(html.includes("/app/paper-readiness-gate"), true);
  assert.equal(html.includes("market_open_required"), true);
  assert.equal(html.includes("PKC3...redacted"), true);
  assert.equal(html.includes("redacted"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
  assert.equal(/type=["']submit["']/i.test(html), false);
});

test("paper broker runtime environment preflight app screen handles missing report safely", () => {
  const runsDir = tempRunsDir();
  const screen = buildPaperBrokerRuntimeEnvironmentPreflightAppScreen({ runsDir });

  assert.equal(screen.ok, true);
  assert.equal(screen.reportFound, false);
  assert.equal(screen.status, "no_runtime_preflight_report");
  assert.equal(screen.runtimeEnvironmentReady, false);
  assert.deepEqual(screen.blockers, ["runtime_preflight_report_missing"]);
  assert.equal(screen.safety.networkAttempted, false);
  assert.equal(screen.safety.orderSubmitted, false);

  const html = renderPaperBrokerRuntimeEnvironmentPreflightAppScreenHtml({ runsDir });
  assert.equal(html.includes("no_runtime_preflight_report"), true);
  assert.equal(html.includes("runtime_preflight_report_missing"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
});
