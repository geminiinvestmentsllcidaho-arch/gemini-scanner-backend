import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("app navigation groups entries by category and keeps readiness quick links read-only", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-07T00:00:00.000Z"),
    autoRefreshEnabled: false,
  });
  const html = renderAppNavigationReadonlyHtml(nav);

  for (const category of ["scanner_app", "paper_lifecycle", "paper_trading", "operator_workflow", "paper_attempt"]) {
    assert.ok(html.includes(`data-app-navigation-category="${category}"`), category);
  }

  for (const heading of ["Scanner App", "Paper Lifecycle", "Paper Trading", "Operator Workflow", "Paper Attempt"]) {
    assert.ok(html.includes(`<h2>${heading}</h2>`), heading);
  }

  assert.ok(html.includes("Related Broker Readiness Routes"));
  assert.ok(html.includes('data-paper-readiness-quick-links="true"'));
  assert.ok(html.includes("/app/paper-app-broker-readiness-index"));
  assert.ok(html.includes("/app/paper-app-readiness-status"));
  assert.ok(html.includes("No execution controls"));
  assert.ok(!html.includes("<form"));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes('type="submit"'));
});
