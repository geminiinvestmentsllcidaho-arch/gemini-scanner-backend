import { timingSafeEqual } from "node:crypto";
import {
  extractOperatorAuthToken,
  isStrongOperatorToken,
  resolveOperatorDashboardToken,
} from "../operator/operator_dashboard.mjs";

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function evaluateAdminAuthorization(providedToken, options = {}) {
  const configuredToken = resolveOperatorDashboardToken(options);
  const enabled = isStrongOperatorToken(configuredToken);
  const allowed = enabled && safeEqual(providedToken, configuredToken);

  return Object.freeze({
    ok: allowed,
    allowed,
    enabled,
    role: "admin",
    policy: "admin_exact_protected_token_v1",
    reason: allowed
      ? "admin_authorized"
      : !enabled
        ? "admin_authorization_disabled"
        : "admin_authorization_required",
  });
}

export function createRequireAdminAuthorization(options = {}) {
  return function requireAdminAuthorization(req, res, next) {
    const providedToken = extractOperatorAuthToken(req);
    const decision = evaluateAdminAuthorization(providedToken, options);

    if (!decision.allowed) {
      return res.status(403).json({
        ok: false,
        error: "admin_authorization_required",
        reason: decision.reason,
      });
    }

    req.adminAuthorization = Object.freeze({
      role: "admin",
      policy: decision.policy,
    });
    return next();
  };
}

export default {
  createRequireAdminAuthorization,
  evaluateAdminAuthorization,
};
