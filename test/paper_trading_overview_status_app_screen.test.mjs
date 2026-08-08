import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaperTradingOverviewStatusAppScreen,
  renderPaperTradingOverviewStatusAppScreenHtml
} from "../src/scanner/paper_trading_overview_status_app_screen.mjs";

test("paper trading overview status app screen aggregates readiness sources safely", () => {
  const screen = buildPaperTradingOverviewStatusAppScreen({
    readiness: {
      route: "/app/paper-readiness-gate",
      status: "not_ready_broker_blocked",
      readinessPct: 71,
      safety: {
        liveTrading: false,
        autoTrading: false,
        accountMutation: false
      }
    },
    goNoGo: {
      status: "no_go",
      finalGo: false,
      reasons: ["broker execution blocked"],
      safety: {
        liveTrading: false,
        autoTrading: false,
        accountMutation: false
      }
    },
    runtime: {
      route: "/app/paper-broker-runtime-environment-preflight",
      status: "blocked",
      runtimeEnvironmentReady: false,
      blockers: ["market_open_required"],
      safety: {
        liveTradingAllowed: false,
        autoTradingAllowed: false,
        accountMutationAllowed: false
      }
    },
    networkAttempt: {
      route: "/app/paper-broker-network-attempt-status",
      status: "blocked",
      reportFound: true,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      safety: {
        liveTradingAllowed: false,
        autoTradingAllowed: false,
        accountMutationAllowed: false
      }
    }
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, "/app/paper-trading-overview-status");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.paperOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.noResetControls, true);
  assert.equal(screen.status, "paper_trading_overview_readonly_broker_blocked");
  assert.equal(screen.displayState, "PAPER_TRADING_OVERVIEW_READONLY_BROKER_BLOCKED");
  assert.equal(screen.summary.readinessPct, 71);
  assert.equal(screen.summary.runtimeEnvironmentReady, false);
  assert.equal(screen.summary.networkAttemptRecorded, true);
  assert.equal(screen.summary.brokerContactAttempted, false);
  assert.equal(screen.summary.orderSubmitAttempted, false);
  assert.equal(screen.summary.orderSubmitted, false);
  assert.equal(screen.summary.accountMutationAttempted, false);
  assert.equal(screen.safety.liveTradingAllowed, false);
  assert.equal(screen.safety.autoTradingAllowed, false);
  assert.equal(screen.safety.accountMutationAllowed, false);
  assert.equal(screen.safety.brokerExecutionAllowed, false);
  assert.equal(screen.safety.newBrokerContactAllowed, false);
  assert.equal(screen.safety.retryAllowed, false);
  assert.equal(screen.safety.resetAllowed, false);
  assert.equal(screen.safety.orderPlacementAllowed, false);
  assert.equal(screen.sources.readiness.route, "/app/paper-readiness-gate");
  assert.equal(screen.sources.runtime.route, "/app/paper-broker-runtime-environment-preflight");
  assert.equal(screen.sources.networkAttempt.route, "/app/paper-broker-network-attempt-status");
});

test("paper trading overview status html has no mutation controls", () => {
  const html = renderPaperTradingOverviewStatusAppScreenHtml({
    readiness: {
      status: "not_ready_broker_blocked",
      readinessPct: 50,
      safety: { liveTrading: false, autoTrading: false, accountMutation: false }
    },
    goNoGo: {
      status: "no_go",
      finalGo: false,
      safety: { liveTrading: false, autoTrading: false, accountMutation: false }
    },
    runtime: {
      status: "blocked",
      runtimeEnvironmentReady: false,
      blockers: ["market_open_required"],
      safety: { liveTradingAllowed: false, autoTradingAllowed: false, accountMutationAllowed: false }
    },
    networkAttempt: {
      status: "blocked",
      reportFound: true,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      safety: { liveTradingAllowed: false, autoTradingAllowed: false, accountMutationAllowed: false }
    }
  });
  const low = html.toLowerCase();

  assert.match(html, /Paper Trading Overview Status/);
  assert.match(html, /No retry, no reset, no new broker contact/);
  assert.equal(low.includes("<form"), false);
  assert.equal(low.includes("<button"), false);
  assert.equal(low.includes("type=\"submit\""), false);
  assert.equal(low.includes("type='submit'"), false);
});
