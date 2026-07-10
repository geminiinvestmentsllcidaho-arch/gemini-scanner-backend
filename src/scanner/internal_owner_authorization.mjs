const DEFAULT_TENANT_ID = "gemini-investments-internal";
const DEFAULT_ROLE = "owner";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function evaluateInternalOwnerAuthorization(context = {}, options = {}) {
  const expectedTenantId = clean(options.tenantId) || DEFAULT_TENANT_ID;
  const expectedRole = clean(options.role) || DEFAULT_ROLE;
  const tenantId = clean(context.tenantId);
  const role = clean(context.role);

  const tenantMatch = tenantId === expectedTenantId;
  const roleMatch = role === expectedRole;
  const allowed = tenantMatch && roleMatch;

  return {
    ok: allowed,
    allowed,
    policy: "internal_owner_exact_tenant_role_v1",
    expectedTenantId,
    expectedRole,
    tenantMatch,
    roleMatch,
    reason: allowed
      ? "internal_owner_authorized"
      : !tenantMatch
        ? "internal_owner_tenant_denied"
        : "internal_owner_role_denied",
  };
}

export function createRequireInternalOwnerAuthorization(options = {}) {
  const context = Object.freeze({
    tenantId: DEFAULT_TENANT_ID,
    role: DEFAULT_ROLE,
  });

  return function requireInternalOwnerAuthorization(req, res, next) {
    const decision = evaluateInternalOwnerAuthorization(context, options);

    if (!decision.allowed) {
      return res.status(403).json({
        ok: false,
        error: "internal_owner_authorization_required",
        reason: decision.reason,
      });
    }

    req.internalOwnerAuthorization = Object.freeze({
      tenantId: context.tenantId,
      role: context.role,
      policy: decision.policy,
    });
    return next();
  };
}

export default {
  createRequireInternalOwnerAuthorization,
  evaluateInternalOwnerAuthorization,
};
