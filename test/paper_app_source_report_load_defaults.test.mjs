import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildPaperBrokerRuntimeEnvironmentPreflightAppScreen
} from "../src/scanner/paper_broker_runtime_environment_preflight_app_screen.mjs";
import {
  buildPaperTradingOverviewStatusAppScreen
} from "../src/scanner/paper_trading_overview_status_app_screen.mjs";

test("paper broker app screens load latest source reports by default", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gs-paper-source-load-"));

  writeFileSync(join(runsDir, "paper_broker_runtime_environment_preflight_blocked_2026.json"), JSON.stringify({
    ok: true,
    status: "blocked",
    runtimeEnvironmentReady: false,
    reportFile: "runs/paper_broker_runtime_environment_preflight_blocked_2026.json",
    environment: {alpacaPaperTradingBaseUrlPresent: true, alpacaPaperRoutePathPresent: true, alpacaApiKeyPresent: true, alpacaApiSecretPresent: true},
    implementationReadiness: {session: {marketOpen: false}, blockers: ["market_open_required"]},
    parameters: {symbol: "SPY", qty: 1, side: "buy", type: "market", timeInForce: "day"},
    safety: {paperOnly: true},
    blockers: ["market_open_required"]
  }));


  const runtime = buildPaperBrokerRuntimeEnvironmentPreflightAppScreen({ runsDir });
  assert.equal(runtime.reportFound, true);
  assert.equal(runtime.status, "blocked");
  assert.equal(runtime.environment.alpacaApiKeyPresent, true);


  const overview = buildPaperTradingOverviewStatusAppScreen({ runtimeInput: { runsDir } });
  assert.equal(overview.summary.runtimeStatus, "blocked");
  assert.equal(overview.blockers.includes("runtime_source_not_loaded"), false);
  assert.equal(overview.blockers.includes("source_panel_not_loaded"), false);
});
