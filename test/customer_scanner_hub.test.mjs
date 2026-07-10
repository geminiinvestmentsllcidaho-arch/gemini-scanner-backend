import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
} from "../src/scanner/customer_scanner_hub.mjs";

test("builds customer scanner hub with customer role and customer-zero tenant support", () => {
  const regular = buildCustomerScannerHub();
  const customerZero = buildCustomerScannerHub({ tenant: "customer-zero" });

  assert.equal(regular.route, "/customer");
  assert.equal(regular.role, "customer");
  assert.equal(regular.tenant, "customer");
  assert.equal(customerZero.role, "customer");
  assert.equal(customerZero.tenant, "customer-zero");
  assert.deepEqual(customerZero.navigation, regular.navigation);
  assert.deepEqual(customerZero.modes, regular.modes);
  assert.deepEqual(customerZero.assetTypes, regular.assetTypes);
  assert.equal(customerZero.readOnly, true);
  assert.equal(customerZero.noExecutionControls, true);
});

test("renders customer-only navigation without admin or internal route references", () => {
  const html = renderCustomerScannerHubHtml(
    buildCustomerScannerHub({ tenant: "customer-zero" })
  );

  assert.match(html, /data-role="customer"/);
  assert.match(html, /data-tenant="customer-zero"/);
  assert.match(html, /Customer navigation/);
  assert.match(html, /\/customer\/scanner\/under-five/);
  assert.doesNotMatch(
    html,
    /\/admin\b|\/diagnostics\b|\/app\b|customer-zero\/|internal owner|paper trading|broker|deployment|security/i
  );
});

test("customer hub keeps decision-assist safety locks closed", () => {
  const hub = buildCustomerScannerHub();

  assert.equal(hub.decisionAssistOnly, true);
  assert.equal(hub.orderPlacementAllowed, false);
  assert.equal(hub.accountMutationAllowed, false);
});
