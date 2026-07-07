import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("app navigation renders related broker readiness quick links read-only", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-07T00:00:00.000Z"),
    autoRefreshEnabled: false,
  });
  const html = renderAppNavigationReadonlyHtml(nav);

  assert.ok(html.includes("Related Broker Readiness Routes"));
  assert.ok(html.includes("data-paper-readiness-quick-links"));
  assert.ok(html.includes("/app/paper-app-broker-readiness-index"));
  assert.ok(html.includes("/app/paper-app-readiness-status"));
  assert.ok(html.includes("/app/paper-app-route-health-status"));
  assert.ok(html.includes("/app/paper-app-safety-lock-status"));
  assert.ok(html.includes("/app/paper-trading-module-final-status"));
  assert.ok(html.includes("no broker contact"));
  assert.ok(html.includes("no order placement"));
  assert.ok(html.includes("no account mutation"));
  assert.ok(!html.includes("<form"));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes('type="submit"'));
});
