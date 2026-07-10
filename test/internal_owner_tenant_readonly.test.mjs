import test from "node:test";
import assert from "node:assert/strict";
import { buildInternalOwnerTenantReadonly } from "../src/scanner/internal_owner_tenant_readonly.mjs";

test("internal owner tenant foundation is internal-only and read-only", () => {
  const model = buildInternalOwnerTenantReadonly();

  assert.equal(model.ok, true);
  assert.equal(model.tenant.id, "gemini-investments-internal");
  assert.equal(model.tenant.type, "internal_test");
  assert.equal(model.tenant.customerSignupEnabled, false);
  assert.equal(model.tenant.publicRegistrationEnabled, false);
  assert.equal(model.user.role, "owner");
  assert.equal(model.user.appAccess, true);
  assert.equal(model.user.adminAccess, true);
  assert.equal(model.access.authenticationImplemented, false);
  assert.equal(model.access.authorizationEnforced, false);
  assert.equal(model.access.tenantIsolationImplemented, false);
  assert.equal(model.credentials.rawSecretsExposed, false);
  assert.equal(model.credentials.migrationRequired, true);
  assert.equal(model.safety.readOnly, true);
  assert.equal(model.safety.orderPlacementAllowed, false);
  assert.equal(model.safety.liveTradingAllowed, false);
  assert.equal(model.safety.autoTradingAllowed, false);
  assert.equal(model.safety.brokerMutationAllowed, false);
});

test("internal owner tenant foundation accepts safe identity labels", () => {
  const model = buildInternalOwnerTenantReadonly({
    tenantId: "tenant-alpha",
    tenantName: "Alpha Internal",
    userId: "owner-alpha",
    displayName: "Owner Alpha",
  });

  assert.equal(model.tenant.id, "tenant-alpha");
  assert.equal(model.tenant.name, "Alpha Internal");
  assert.equal(model.user.id, "owner-alpha");
  assert.equal(model.user.displayName, "Owner Alpha");
});
