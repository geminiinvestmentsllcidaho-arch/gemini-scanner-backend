const DEFAULT_TENANT_ID = "gemini-investments-internal";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function evaluateInternalOwnerTenantIsolation(context = {}, options = {}) {
  const expectedTenantId = clean(options.tenantId) || DEFAULT_TENANT_ID;
  const tenantId = clean(context.tenantId);
  const isolated = tenantId === expectedTenantId;

  return {
    ok: isolated,
    isolated,
    policy: "internal_owner_single_tenant_request_scope_v1",
    expectedTenantId,
    tenantId,
    reason: isolated
      ? "internal_owner_tenant_isolated"
      : "internal_owner_tenant_isolation_denied",
  };
}

export function createRequireInternalOwnerTenantIsolation(options = {}) {
  return function requireInternalOwnerTenantIsolation(req, res, next) {
    const decision = evaluateInternalOwnerTenantIsolation(
      { tenantId: req?.internalOwnerAuthorization?.tenantId },
      options
    );

    if (!decision.isolated) {
      return res.status(403).json({
        ok: false,
        error: "internal_owner_tenant_isolation_required",
        reason: decision.reason,
      });
    }

    req.internalOwnerTenantContext = Object.freeze({
      tenantId: decision.tenantId,
      isolationPolicy: decision.policy,
    });
    return next();
  };
}

export default {
  createRequireInternalOwnerTenantIsolation,
  evaluateInternalOwnerTenantIsolation,
};
