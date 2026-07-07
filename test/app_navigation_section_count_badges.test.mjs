import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("app navigation grouped sections show read-only entry count badges", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-07T00:00:00.000Z"),
    autoRefreshEnabled: false,
  });
  const html = renderAppNavigationReadonlyHtml(nav);

  assert.ok(html.includes('data-app-navigation-summary="true"'));
  assert.ok(html.includes('data-app-navigation-category="scanner_app"'));
  assert.ok(html.includes('data-app-navigation-category="paper_lifecycle"'));
  assert.ok(html.includes('data-app-navigation-entry-count="1"'));
  assert.ok(html.includes('class="entry-count"'));
  assert.ok(html.includes("entries</small>"));
  assert.ok(html.includes("Related Broker Readiness Routes"));
  assert.ok(html.includes("Read-only Locks"));
  assert.ok(html.includes("no execution controls"));
  assert.ok(!html.includes("<form"));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes('type="submit"'));
});
