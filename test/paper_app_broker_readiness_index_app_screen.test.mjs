import test from "node:test";
import assert from "node:assert/strict";

import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";
import {
  ROUTE,
  buildPaperAppBrokerReadinessIndexAppScreen,
  renderPaperAppBrokerReadinessIndexAppScreenHtml
} from "../src/scanner/paper_app_broker_readiness_index_app_screen.mjs";

test("paper app broker readiness index is read only and locked", () => {
  const screen = buildPaperAppBrokerReadinessIndexAppScreen({
    now: new Date("2026-01-01T00:00:00.000Z")
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, "/app/paper-app-broker-readiness-index");
  assert.equal(screen.route, ROUTE);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.noResetControls, true);
  assert.equal(screen.status, "paper_app_broker_readiness_index_ready_readonly");
  assert.equal(screen.displayState, "PAPER_APP_BROKER_READINESS_INDEX_READY_READONLY");
  assert.equal(screen.checks.requiredRoutesLinked, true);
  assert.equal(screen.checks.allSafetyLocksClosed, true);
  assert.equal(screen.summary.missingRequiredRouteCount, 0);

  for (const value of Object.values(screen.safety)) {
    assert.equal(value, false);
  }
});

test("paper app broker readiness index html has no mutation controls", () => {
  const html = renderPaperAppBrokerReadinessIndexAppScreenHtml(
    buildPaperAppBrokerReadinessIndexAppScreen()
  );
  const lower = html.toLowerCase();

  assert.ok(html.includes("Paper App Broker Readiness Index"));
  assert.ok(html.includes("No route execution, no broker contact, no order submit"));
  assert.ok(html.includes("Required Broker Readiness Routes"));
  assert.ok(html.includes("Broker Readiness Route Links"));
  assert.ok(html.includes("Safety Locks"));
  assert.ok(html.includes("/app/paper-broker-runtime-environment-preflight"));
  assert.ok(html.includes("/app/paper-trade-readiness-report"));
  assert.equal(lower.includes("<form"), false);
  assert.equal(lower.includes("<button"), false);
  assert.equal(lower.includes("type=\"submit\""), false);
  assert.equal(lower.includes("type='submit'"), false);
});

test("app navigation links paper app broker readiness index", () => {
  const nav = buildAppNavigationReadonly({});
  const entry = nav.entries.find((item) => item.routeHref === ROUTE);

  assert.ok(entry);
  assert.equal(entry.title, "Paper App Broker Readiness Index");
  assert.equal(entry.category, "paper_lifecycle");
  assert.equal(entry.href, ROUTE);
  assert.equal(entry.diagnosticHref, ROUTE);
  assert.equal(entry.displayState, "PAPER_APP_BROKER_READINESS_INDEX_READONLY");
});
