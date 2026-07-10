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
  assert.equal(screen.credentials.rawSecretsExposed, false);
  assert.equal(screen.safety.readOnly, true);
  assert.equal(screen.safety.orderPlacementAllowed, false);
});

test("renders owner screen without mutation controls", () => {
  const html = renderInternalOwnerTenantAppScreenHtml();
  assert.match(html, /Internal Owner Account/);
  assert.match(html, /protected by the existing operator token/);
  assert.match(html, /Authentication implemented:<\/b> yes/);
  assert.match(html, /Authentication mode:<\/b> shared_operator_token/);
  assert.match(html, /Route protection implemented:<\/b> yes/);
  assert.match(html, /Authorization enforced:<\/b> yes/);
  assert.match(html, /Authorization policy:<\/b> internal_owner_exact_tenant_role_v1/);
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
