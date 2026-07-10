const VERSION = "internal_owner_tenant_readonly_v1";

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function buildInternalOwnerTenantReadonly(options = {}) {
  const credentialStoreStatus = options.credentialStoreStatus && typeof options.credentialStoreStatus === "object"
    ? options.credentialStoreStatus
    : {};

  return {
    ok: true,
    version: VERSION,
    tenant: {
      id: clean(options.tenantId, "gemini-investments-internal"),
      name: clean(options.tenantName, "Gemini Investments Internal"),
      type: "internal_test",
      status: "active_internal_only",
      customerSignupEnabled: false,
      publicRegistrationEnabled: false,
    },
    user: {
      id: clean(options.userId, "owner-001"),
      displayName: clean(options.displayName, "Platform Owner"),
      role: "owner",
      appAccess: true,
      adminAccess: true,
      supportImpersonationAllowed: false,
    },
    access: {
      appHref: "/app",
      adminHref: "/admin",
      connectionsHref: "/app/connections",
      authenticationImplemented: true,
      authenticationMode: "shared_operator_token",
      routeProtectionImplemented: true,
      authorizationEnforced: true,
      authorizationPolicy: "internal_owner_exact_tenant_role_v1",
      tenantIsolationImplemented: true,
      tenantIsolationPolicy: "internal_owner_single_tenant_request_scope_v1",
      multiTenantDataPartitioningImplemented: false,
    },
    credentials: {
      storageMode: clean(credentialStoreStatus.storageMode, "encrypted_local_file_per_tenant"),
      encryptedPerTenantStorageImplemented: credentialStoreStatus.encryptionImplemented === true,
      encryptionPolicy: clean(credentialStoreStatus.encryptionPolicy, "aes_256_gcm_per_tenant_envelope_v1"),
      keyConfigured: credentialStoreStatus.keyConfigured === true,
      storeExists: credentialStoreStatus.storeExists === true,
      storePathLabel: clean(credentialStoreStatus.storePathLabel, "internal_owner_tenant_credentials.enc.json"),
      rawSecretsExposed: false,
      migrationRequired: credentialStoreStatus.storeExists !== true,
    },
    safety: {
      readOnly: true,
      decisionAssistOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      brokerMutationAllowed: false,
    },
    displayState: "INTERNAL_OWNER_TENANT_FOUNDATION_READONLY",
  };
}
