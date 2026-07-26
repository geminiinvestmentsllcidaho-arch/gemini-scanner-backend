import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInternalOwnerTenantAppScreen,
  renderInternalOwnerTenantAppScreenHtml,
} from "../src/scanner/internal_owner_tenant_app_screen.mjs";

test("builds internal owner tenant bootstrap app screen safely", () => {
  const screen = buildInternalOwnerTenantAppScreen();
  assert.equal(screen.ok, true);
  assert.equal(screen.route, "/app/internal-owner");
  assert.equal(screen.user.role, "owner");
  assert.equal(screen.tenant.publicRegistrationEnabled, false);
  assert.equal(screen.access.authenticationImplemented, true);
  assert.equal(screen.access.authenticationMode, "shared_operator_token");
  assert.equal(screen.access.routeProtectionImplemented, true);
  assert.equal(screen.access.authorizationEnforced, true);
  assert.equal(screen.access.authorizationPolicy, "internal_owner_exact_tenant_role_v1");
  assert.equal(screen.access.tenantIsolationImplemented, true);
  assert.equal(screen.access.tenantIsolationPolicy, "internal_owner_single_tenant_request_scope_v1");
  assert.equal(screen.access.multiTenantDataPartitioningImplemented, false);
  assert.equal(screen.access.multiTenantDataPartitioningPolicy, "customer_tenant_account_path_partition_v1");
  assert.equal(screen.access.existingCustomerStoresMigrated, false);
  assert.equal(screen.access.customerRuntimeStoreCutoverEnabled, false);
  assert.equal(screen.credentials.encryptedPerTenantStorageImplemented, false);
  assert.equal(screen.credentials.encryptionPolicy, "aes_256_gcm_per_tenant_envelope_v1");
  assert.equal(screen.credentials.keyConfigured, false);
  assert.equal(screen.credentials.storeExists, false);
  assert.equal(screen.credentials.rawSecretsExposed, false);
  assert.equal(screen.safety.readOnly, true);
  assert.equal(screen.safety.brokerContactAllowed, false);
  assert.equal(screen.safety.orderPlacementAllowed, false);
});

test("renders owner screen without mutation controls", () => {
  const html = renderInternalOwnerTenantAppScreenHtml();
  assert.match(html, /Internal Owner Account/);
  assert.match(html, /protected by the existing operator token/);
  assert.match(html, /Existing customer stores are not migrated/);
  assert.match(html, /Data partitioning policy:<\/b> customer_tenant_account_path_partition_v1/);
  assert.match(html, /Existing customer stores migrated:<\/b> no/);
  assert.match(html, /Runtime store cutover enabled:<\/b> no/);
  assert.match(html, /Authentication implemented:<\/b> yes/);
  assert.match(html, /Authentication mode:<\/b> shared_operator_token/);
  assert.match(html, /Route protection implemented:<\/b> yes/);
  assert.match(html, /Authorization enforced:<\/b> yes/);
  assert.match(html, /Authorization policy:<\/b> internal_owner_exact_tenant_role_v1/);
  assert.match(html, /Encrypted per-tenant credential storage:<\/b> no/);
  assert.match(html, /Credential encryption policy:<\/b> aes_256_gcm_per_tenant_envelope_v1/);
  assert.match(html, /Credential key configured:<\/b> no/);
  assert.match(html, /Credential store exists:<\/b> no/);
  assert.match(html, /Migration required:<\/b> yes/);
  assert.match(html, /Raw secrets exposed:<\/b> no/);
  assert.match(html, /Order placement allowed:<\/b> no/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<input/i);
  assert.doesNotMatch(html, /<button/i);
});

test("escapes supplied identity labels", () => {
  const screen = buildInternalOwnerTenantAppScreen({
    tenantName: '<script>alert(1)</script>',
    displayName: '<img src=x onerror="alert(1)">',
  });
  const html = renderInternalOwnerTenantAppScreenHtml(screen);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x/);
});
