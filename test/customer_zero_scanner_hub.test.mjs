import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildCustomerZeroScannerHub,
  renderCustomerZeroScannerHubHtml,
} from "../src/scanner/customer_zero_scanner_hub.mjs";

test("builds Customer Zero scanner hub with intraday and stocks defaults", () => {
  const hub = buildCustomerZeroScannerHub();

  assert.equal(hub.route, "/customer-zero/scanner");
  assert.equal(hub.role, "customer_zero");
  assert.equal(hub.defaultMode, "intraday");
  assert.equal(hub.defaultAssetType, "stocks");
  assert.equal(hub.modes[0].id, "intraday");
  assert.equal(hub.modes[0].status, "available");
  assert.equal(hub.modes[1].id, "under_five");
  assert.equal(hub.modes[1].status, "available");
  assert.equal(hub.assetTypes[0].id, "stocks");
  assert.equal(hub.assetTypes[0].status, "available");
  assert.equal(hub.assetTypes.find((item) => item.id === "etfs").status, "coming_soon");
  assert.equal(hub.assetTypes.find((item) => item.id === "crypto").status, "coming_soon");
  assert.equal(hub.readOnly, true);
  assert.equal(hub.decisionAssistOnly, true);
  assert.equal(hub.noExecutionControls, true);
  assert.equal(hub.orderPlacementAllowed, false);
  assert.equal(hub.accountMutationAllowed, false);
});

test("renders scanner hub choices without execution controls", () => {
  const html = renderCustomerZeroScannerHubHtml();

  assert.match(html, /Customer Zero — Scanner/);
  assert.match(html, /Scanner mode/);
  assert.match(html, /Intraday/);
  assert.match(html, /Under \$5/);
  assert.match(html, /Swing/);
  assert.match(html, /Long-term/);
  assert.match(html, /Watchlist/);
  assert.match(html, /Asset type/);
  assert.match(html, /Stocks/);
  assert.match(html, /ETFs/);
  assert.match(html, /Crypto/);
  assert.match(html, /Options/);
  assert.match(html, /Coming soon/);
  assert.match(html, /Decision assist only/);
  assert.doesNotMatch(html, /\bPOST\b|\bDELETE\b|XMLHttpRequest|\bfetch\s*\(/);
});

test("server and navigation expose Customer Zero scanner hub route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const nav = fs.readFileSync("src/scanner/app_navigation_readonly.mjs", "utf8");

  assert.match(server, /app\.get\('\/customer-zero\/scanner'/);
  assert.match(server, /buildCustomerZeroScannerHub/);
  assert.match(server, /renderCustomerZeroScannerHubHtml/);
  assert.match(nav, /id: "customer_zero_scanner_hub"/);
  assert.match(nav, /href: "\/customer-zero\/scanner"/);
});
