import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("new user home prioritizes six core read-only actions", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-10T04:50:00.000Z"),
    autoRefreshEnabled: false,
  });
  const html = renderAppNavigationReadonlyHtml(nav);

  for (const label of [
    "Run Scanner",
    "Watchlist",
    "Paper Account",
    "Positions",
    "Trade Plan",
    "History",
  ]) {
    assert.ok(html.includes(label), label);
  }

  assert.ok(html.includes("Start Here"));
  assert.ok(html.includes("Advanced &amp; System Tools"));
  assert.ok(html.includes("Decision assist only"));
  assert.ok(html.includes("Order placement, live trading, and auto trading remain disabled"));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes("<form"));
  assert.ok(!html.includes('type="submit"'));
});
