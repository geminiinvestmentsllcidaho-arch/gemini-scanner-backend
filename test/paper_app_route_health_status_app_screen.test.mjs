import test from "node:test";
import assert from "node:assert/strict";

import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";
import {
  ROUTE,
  buildPaperAppRouteHealthStatusAppScreen,
  renderPaperAppRouteHealthStatusAppScreenHtml
} from "../src/scanner/paper_app_route_health_status_app_screen.mjs";

test("paper app route health status app screen summarizes paper routes safely", () => {
  const screen = buildPaperAppRouteHealthStatusAppScreen({
    now: new Date("2026-01-01T00:00:00.000Z")
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, ROUTE);
  assert.equal(screen.route, "/app/paper-app-route-health-status");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.noResetControls, true);
  assert.equal(screen.status, "paper_app_route_health_ready_readonly");
  assert.equal(screen.displayState, "PAPER_APP_ROUTE_HEALTH_READY_READONLY");
  assert.ok(screen.summary.paperRouteCount >= 30);
  assert.equal(screen.summary.paperRouteCount, screen.summary.uniquePaperRouteCount);
  assert.equal(screen.checks.hasPaperRoutes, true);
  assert.equal(screen.checks.routeHrefsPresent, true);
  assert.equal(screen.checks.routeHrefsUnique, true);
  assert.equal(screen.checks.noExecutionControls, true);
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
});

test("paper app route health status html has no mutation controls", () => {
  const screen = buildPaperAppRouteHealthStatusAppScreen({
    entries: [
      {
        label: "Paper Trading Overview Status",
        category: "paper_lifecycle",
        routeHref: "/app/paper-trading-overview-status"
      },
      {
        label: "Paper App Route Health Status",
        category: "paper_lifecycle",
        routeHref: "/app/paper-app-route-health-status"
      }
    ],
    now: new Date("2026-01-01T00:00:00.000Z")
  });

  const html = renderPaperAppRouteHealthStatusAppScreenHtml(screen);
  const lower = html.toLowerCase();

  assert.ok(html.includes("Paper App Route Health Status"));
  assert.ok(html.includes("No route execution, no broker contact, no order submit, no retry, no reset, no account mutation."));
  assert.equal(lower.includes("<form"), false);
  assert.equal(lower.includes("<button"), false);
  assert.equal(lower.includes("type=\"submit\""), false);
  assert.equal(lower.includes("type='submit'"), false);
});

test("app navigation links paper app route health status screen", () => {
  const nav = buildAppNavigationReadonly({});
  const entry = nav.entries.find((item) => item.routeHref === ROUTE);

  assert.ok(entry);
  assert.equal(entry.title, "Paper App Route Health Status");
  assert.equal(entry.category, "paper_lifecycle");
  assert.equal(entry.href, ROUTE);
  assert.equal(entry.diagnosticHref, ROUTE);
  assert.equal(entry.displayState, "PAPER_APP_ROUTE_HEALTH_STATUS_READONLY");
});
