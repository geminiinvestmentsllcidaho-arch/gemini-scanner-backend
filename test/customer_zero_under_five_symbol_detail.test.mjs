import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildCustomerZeroUnderFiveSymbolDetail,
  renderCustomerZeroUnderFiveSymbolDetailHtml,
} from "../src/scanner/customer_zero_under_five_symbol_detail.mjs";

test("builds expanded read-only symbol explanation", () => {
  const detail = buildCustomerZeroUnderFiveSymbolDetail({
    symbol: "TEST",
    decision: "ENTER",
    briefExplanation: "Strong score with positive momentum.",
    readonlyPotentialScore: 91,
    readonlyPotentialLabel: "strong_watch",
    price: 4.5,
    previousClose: 4,
    changePct: 12.5,
    spreadPct: 0.44,
    dailyVolume: 1000000,
    dollarVolume: 4500000,
    sourceAgeSec: 10,
    sourceStale: false,
    readonlyPotentialFlags: [],
    blockingFlags: [],
  });

  assert.equal(detail.route, "/customer-zero/under-five-scanner/TEST");
  assert.equal(detail.decision, "ENTER");
  assert.ok(detail.passedChecks.includes("Freshness check passed"));
  assert.equal(detail.decisionAssistOnly, true);
  assert.equal(detail.buyRecommendation, false);
  assert.equal(detail.orderPlacementAllowed, false);
});

test("renders full scan explanation and safety locks", () => {
  const html = renderCustomerZeroUnderFiveSymbolDetailHtml(
    buildCustomerZeroUnderFiveSymbolDetail({
      symbol: "BLOCK",
      decision: "DO_NOT_ENTER",
      briefExplanation: "Do not enter: wide_spread.",
      readonlyPotentialScore: 39,
      spreadPct: 6,
      sourceStale: false,
      readonlyPotentialFlags: ["wide_spread"],
      blockingFlags: ["wide_spread"],
    })
  );

  assert.match(html, /DO NOT ENTER/);
  assert.match(html, /Scan results/);
  assert.match(html, /Checks passed/);
  assert.match(html, /Blocking reasons/);
  assert.match(html, /wide_spread/);
  assert.match(html, /Decision assist only:<\/b> true/);
  assert.match(html, /Buy recommendation:<\/b> false/);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|\bPOST\b|\rDELETE\b/);
});

test("server exposes symbol detail route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  assert.match(server, /app\.get\('\/customer-zero\/under-five-scanner\/:symbol'/);
  assert.match(server, /buildCustomerZeroUnderFiveSymbolDetail/);
  assert.match(server, /renderCustomerZeroUnderFiveSymbolDetailHtml/);
});

test("renders customer symbol detail with shared neon theme and fixed background logo", () => {
  const detail = buildCustomerZeroUnderFiveSymbolDetail(
    { symbol: "TEST", decision: "WAIT" },
    {
      routeBase: "/customer/scanner/under-five",
      role: "customer",
      roleLabel: "Customer",
      tenant: "customer",
    },
  );
  const html = renderCustomerZeroUnderFiveSymbolDetailHtml(detail);
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v1"/);
  assert.match(html, /data-gs-surface="customer"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
  assert.match(html, /data-gs-page="customer-under-five-symbol-detail"/);
  assert.match(html, /data-role="customer" data-page="under-five-symbol-detail"/);
  assert.doesNotMatch(html, /\/admin\b/);
});
