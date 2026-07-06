import test from "node:test";
import assert from "node:assert/strict";

import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";
import {
  ROUTE,
  buildPaperAppSafetyLockStatusAppScreen,
  renderPaperAppSafetyLockStatusAppScreenHtml
} from "../src/scanner/paper_app_safety_lock_status_app_screen.mjs";

test("paper app safety lock status screen keeps every execution lock closed", () => {
  const screen = buildPaperAppSafetyLockStatusAppScreen({
    now: new Date("2026-01-01T00:00:00.000Z")
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, ROUTE);
  assert.equal(screen.route, "/app/paper-app-safety-lock-status");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.noResetControls, true);
  assert.equal(screen.status, "paper_app_safety_locks_locked_readonly");
  assert.equal(screen.displayState, "PAPER_APP_SAFETY_LOCK_STATUS_LOCKED_READONLY");
  assert.equal(screen.checks.allSafetyLocksClosed, true);
  assert.equal(screen.checks.routeLinkedInNavigation, true);
  assert.equal(screen.summary.unsafeOpenLockCount, 0);
  assert.ok(screen.summary.lockedSafetyFlagCount >= 10);
  assert.equal(screen.safety.liveTradingAllowed, false);
  assert.equal(screen.safety.autoTradingAllowed, false);
  assert.equal(screen.safety.brokerExecutionAllowed, false);
  assert.equal(screen.safety.brokerContactAllowed, false);
  assert.equal(screen.safety.newBrokerContactAllowed, false);
  assert.equal(screen.safety.orderPlacementAllowed, false);
  assert.equal(screen.safety.orderSubmitAllowed, false);
  assert.equal(screen.safety.retryAllowed, false);
  assert.equal(screen.safety.resetAllowed, false);
  assert.equal(screen.safety.accountMutationAllowed, false);
  assert.equal(screen.safety.routeExecutionAllowed, false);
});

test("paper app safety lock status html has no mutation controls", () => {
  const screen = buildPaperAppSafetyLockStatusAppScreen({
    entries: [
      {
        id: "paper_app_safety_lock_status",
        title: "Paper App Safety Lock Status",
        category: "paper_lifecycle",
        routeHref: "/app/paper-app-safety-lock-status",
        displayState: "PAPER_APP_SAFETY_LOCK_STATUS_READONLY"
      }
    ],
    now: new Date("2026-01-01T00:00:00.000Z")
  });

  const html = renderPaperAppSafetyLockStatusAppScreenHtml(screen);
  const lower = html.toLowerCase();

  assert.ok(html.includes("Paper App Safety Lock Status"));
  assert.ok(html.includes("No route execution, no broker contact, no order submit, no retry, no reset, no account mutation."));
  assert.ok(html.includes("Related Broker Readiness Routes"));
  assert.ok(html.includes("/app/paper-app-broker-readiness-index"));
  assert.ok(html.includes("/app/paper-broker-runtime-environment-preflight"));
  assert.ok(html.includes("/app/paper-broker-network-attempt-status"));
  assert.ok(html.includes("/app/paper-trade-readiness-report"));
  assert.equal(lower.includes("<form"), false);
  assert.equal(lower.includes("<button"), false);
  assert.equal(lower.includes("type=\"submit\""), false);
  assert.equal(lower.includes("type='submit'"), false);
});

test("app navigation links paper app safety lock status screen", () => {
  const nav = buildAppNavigationReadonly({});
  const entry = nav.entries.find((item) => item.routeHref === ROUTE);

  assert.ok(entry);
  assert.equal(entry.title, "Paper App Safety Lock Status");
  assert.equal(entry.category, "paper_lifecycle");
  assert.equal(entry.href, ROUTE);
  assert.equal(entry.diagnosticHref, ROUTE);
  assert.equal(entry.displayState, "PAPER_APP_SAFETY_LOCK_STATUS_READONLY");
});
