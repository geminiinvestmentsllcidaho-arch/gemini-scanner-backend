import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildCustomerZeroUnderFiveDashboard,
  renderCustomerZeroUnderFiveDashboardHtml,
} from "../src/scanner/customer_zero_under_five_dashboard.mjs";

test("builds Customer Zero under-five dashboard with read-only safety locks", () => {
  const dashboard = buildCustomerZeroUnderFiveDashboard({
    ok: true,
    status: "connected_readonly",
    candidateCount: 1,
    candidates: [{
      symbol: "TEST",
      price: 3.25,
      readonlyPotentialScore: 88,
      readonlyPotentialLabel: "strong_watch",
      readonlyPotentialFlags: [],
      decisionAssistOnly: true,
      buyRecommendation: false,
    }],
  }, {
    now: new Date("2026-07-10T19:00:00.000Z"),
    refreshIntervalSec: 30,
  });

  assert.equal(dashboard.role, "customer_zero");
  assert.equal(dashboard.route, "/customer-zero/under-five-scanner");
  assert.equal(dashboard.readOnly, true);
  assert.equal(dashboard.decisionAssistOnly, true);
  assert.equal(dashboard.noExecutionControls, true);
  assert.equal(dashboard.orderPlacementAllowed, false);
  assert.equal(dashboard.accountMutationAllowed, false);
});

test("renders Customer Zero role badge without execution controls", () => {
  const dashboard = buildCustomerZeroUnderFiveDashboard({
    ok: true,
    status: "connected_readonly",
    candidates: [],
  });
  const html = renderCustomerZeroUnderFiveDashboardHtml(dashboard);

  assert.match(html, /data-role-badge="customer-zero"/);
  assert.match(html, /Role:<\/b> Customer Zero/);
  assert.match(html, /Decision assist only/);
  assert.doesNotMatch(html, /\bPOST\b|\bDELETE\b|XMLHttpRequest|\bfetch\s*\(/);
});

test("server and navigation expose Customer Zero under-five route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const nav = fs.readFileSync("src/scanner/app_navigation_readonly.mjs", "utf8");

  assert.match(server, /app\.get\('\/customer-zero\/under-five-scanner'/);
  assert.match(server, /buildCustomerZeroUnderFiveDashboard/);
  assert.match(server, /renderCustomerZeroUnderFiveDashboardHtml/);
  assert.match(nav, /id: "customer_zero_under_five_scanner"/);
  assert.match(nav, /href: "\/customer-zero\/under-five-scanner"/);
});
