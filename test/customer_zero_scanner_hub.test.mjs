import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
} from "../src/scanner/customer_scanner_hub.mjs";

test("Customer Zero uses the regular customer role and exact customer interface", () => {
  const regular = buildCustomerScannerHub();
  const customerZero = buildCustomerScannerHub({ tenant: "customer-zero" });

  assert.equal(customerZero.route, "/customer");
  assert.equal(customerZero.role, "customer");
  assert.equal(customerZero.tenant, "customer-zero");
  assert.deepEqual(customerZero.navigation, regular.navigation);
  assert.deepEqual(customerZero.modes, regular.modes);
  assert.deepEqual(customerZero.assetTypes, regular.assetTypes);
  assert.equal(customerZero.readOnly, true);
  assert.equal(customerZero.decisionAssistOnly, true);
  assert.equal(customerZero.noExecutionControls, true);
  assert.equal(customerZero.orderPlacementAllowed, false);
  assert.equal(customerZero.accountMutationAllowed, false);
});

test("Customer Zero renders the same customer navigation without admin access", () => {
  const regularHtml = renderCustomerScannerHubHtml(buildCustomerScannerHub());
  const customerZeroHtml = renderCustomerScannerHubHtml(
    buildCustomerScannerHub({ tenant: "customer-zero" })
  );

  for (const label of ["Home", "Scanner", "Under $5", "Watchlist", "Settings"]) {
    assert.equal(regularHtml.includes(`>${label}<`), true);
    assert.equal(customerZeroHtml.includes(`>${label}<`), true);
  }

  assert.match(customerZeroHtml, /data-role="customer"/);
  assert.match(customerZeroHtml, /data-tenant="customer-zero"/);
  assert.doesNotMatch(
    customerZeroHtml,
    /\/admin\b|\/diagnostics\b|\/app\b|internal owner|paper trading|broker|deployment|security/i
  );
});

test("server routes Customer Zero through the shared customer hub", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const route = server.match(
    /app\.get\('\/customer-zero\/scanner'[\s\S]*?\n}\);/
  )?.[0] ?? "";

  assert.match(route, /customer_scanner_hub\.mjs/);
  assert.match(route, /buildCustomerScannerHub\(\{ tenant: 'customer-zero' \}\)/);
  assert.match(route, /renderCustomerScannerHubHtml/);
  assert.doesNotMatch(route, /customer_zero_scanner_hub\.mjs/);
});
