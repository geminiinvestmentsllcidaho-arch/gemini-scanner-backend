import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("app navigation renders category summary and read-only lock overview", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-07T00:00:00.000Z"),
    autoRefreshEnabled: false,
  });
  const html = renderAppNavigationReadonlyHtml(nav);

  assert.ok(html.includes('data-app-navigation-summary="true"'));
  assert.ok(html.includes("Navigation Summary"));
  assert.ok(html.includes("Registered Views"));
  assert.ok(html.includes("Categories"));
  assert.ok(html.includes("Readiness Quick Links"));
  assert.ok(html.includes("Read-only Locks"));
  assert.ok(html.includes("no execution controls"));
  assert.ok(html.includes("no broker contact"));
  assert.ok(html.includes("no order placement"));
  assert.ok(html.includes("no account mutation"));
  assert.ok(html.includes('data-app-navigation-category="scanner_app"'));
  assert.ok(html.includes('data-app-navigation-category="paper_lifecycle"'));
  assert.ok(html.includes('data-app-navigation-category="paper_trading"'));
  assert.ok(html.includes('data-paper-readiness-quick-links="true"'));
  assert.ok(!html.includes("<form"));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes('type="submit"'));
});
