import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("app navigation summary renders read-only category jump links", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-07T00:00:00.000Z"),
    autoRefreshEnabled: false,
  });
  const html = renderAppNavigationReadonlyHtml(nav);

  for (const category of ["scanner_app", "paper_lifecycle", "paper_trading", "operator_workflow", "paper_attempt"]) {
    const anchor = `app-nav-${category.replace(/_/g, "-")}`;
    assert.ok(html.includes(`id="${anchor}"`), anchor);
    assert.ok(html.includes(`href="#${anchor}"`), anchor);
  }

  assert.ok(html.includes('data-app-navigation-jump-links="true"'));
  assert.ok(html.includes("Jump to section"));
  assert.ok(html.includes("Navigation Summary"));
  assert.ok(html.includes("Related Broker Readiness Routes"));
  assert.ok(html.includes("Read-only Locks"));
  assert.ok(html.includes("no execution controls"));
  assert.ok(!html.includes("<form"));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes('type="submit"'));
});
