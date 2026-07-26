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
  assert.equal(model.access.authenticationImplemented, true);
  assert.equal(model.access.authenticationMode, "shared_operator_token");
  assert.equal(model.access.routeProtectionImplemented, true);
  assert.equal(model.access.authorizationEnforced, true);
  assert.equal(model.access.authorizationPolicy, "internal_owner_exact_tenant_role_v1");
  assert.equal(model.access.tenantIsolationImplemented, true);
  assert.equal(model.access.tenantIsolationPolicy, "internal_owner_single_tenant_request_scope_v1");
  assert.equal(model.access.multiTenantDataPartitioningImplemented, false);
  assert.equal(model.access.multiTenantDataPartitioningPolicy, "customer_tenant_account_path_partition_v1");
  assert.equal(model.access.existingCustomerStoresMigrated, false);
  assert.equal(model.access.customerRuntimeStoreCutoverEnabled, false);
  assert.equal(model.credentials.storageMode, "encrypted_local_file_per_tenant");
  assert.equal(model.credentials.encryptedPerTenantStorageImplemented, false);
  assert.equal(model.credentials.encryptionPolicy, "aes_256_gcm_per_tenant_envelope_v1");
  assert.equal(model.credentials.keyConfigured, false);
  assert.equal(model.credentials.storeExists, false);
  assert.equal(model.credentials.rawSecretsExposed, false);
  assert.equal(model.credentials.migrationRequired, true);
  assert.equal(model.safety.readOnly, true);
  assert.equal(model.safety.brokerContactAllowed, false);
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


test("internal owner tenant foundation accepts safe credential store status", () => {
  const model = buildInternalOwnerTenantReadonly({
    credentialStoreStatus: {
      storageMode: "encrypted_local_file_per_tenant",
      encryptionImplemented: true,
      encryptionPolicy: "aes_256_gcm_per_tenant_envelope_v1",
      keyConfigured: true,
      storeExists: true,
      storePathLabel: "credentials.enc.json",
    },
  });

  assert.equal(model.credentials.encryptedPerTenantStorageImplemented, true);
  assert.equal(model.credentials.keyConfigured, true);
  assert.equal(model.credentials.storeExists, true);
  assert.equal(model.credentials.storePathLabel, "credentials.enc.json");
  assert.equal(model.credentials.migrationRequired, false);
  assert.equal(model.credentials.rawSecretsExposed, false);
});


test("internal owner tenant foundation reports customer path partitioning without migration or cutover", () => {
  const model = buildInternalOwnerTenantReadonly({
    dataPartitioningStatus: {
      pathPartitioningImplemented: true,
      policy: "customer_tenant_account_path_partition_v1",
      existingStoresMigrated: false,
      runtimeStoreCutoverEnabled: false,
    },
  });

  assert.equal(model.access.multiTenantDataPartitioningImplemented, true);
  assert.equal(model.access.multiTenantDataPartitioningPolicy, "customer_tenant_account_path_partition_v1");
  assert.equal(model.access.existingCustomerStoresMigrated, false);
  assert.equal(model.access.customerRuntimeStoreCutoverEnabled, false);
  assert.equal(model.safety.readOnly, true);
  assert.equal(model.safety.orderPlacementAllowed, false);
});
