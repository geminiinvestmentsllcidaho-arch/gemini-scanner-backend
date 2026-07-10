const VERSION = "internal_owner_tenant_readonly_v1";

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function buildInternalOwnerTenantReadonly(options = {}) {
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
      authorizationEnforced: false,
      tenantIsolationImplemented: false,
    },
    credentials: {
      storageMode: "existing_server_environment",
      encryptedPerTenantStorageImplemented: false,
      rawSecretsExposed: false,
      migrationRequired: true,
    },
    safety: {
      readOnly: true,
      decisionAssistOnly: true,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      brokerMutationAllowed: false,
    },
    displayState: "INTERNAL_OWNER_TENANT_FOUNDATION_READONLY",
  };
}
