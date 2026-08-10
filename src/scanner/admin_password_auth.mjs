import { timingSafeEqual } from "node:crypto";

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function resolveAdminPassword(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "password")) {
    return clean(options.password);
  }
  return clean(process.env.ADMIN_PASSWORD);
}

export function isStrongAdminPassword(password) {
  const value = clean(password);
  if (value.length < ADMIN_PASSWORD_MIN_LENGTH) return false;
  if (/^\d+$/.test(value)) return false;
  if (/^(password|admin|administrator|geminiscanner|changeme|letmein)$/i.test(value)) return false;
  return true;
}

export function evaluateAdminPassword(providedPassword, options = {}) {
  const configuredPassword = resolveAdminPassword(options);
  const enabled = isStrongAdminPassword(configuredPassword);
  const allowed = enabled && safeEqual(providedPassword, configuredPassword);
  return Object.freeze({
    ok: allowed,
    allowed,
    enabled,
    role: "admin",
    policy: "admin_password_v1",
    reason: allowed
      ? "admin_password_authorized"
      : !enabled
        ? "admin_password_disabled"
        : "admin_password_required",
  });
}

export default {
  ADMIN_PASSWORD_MIN_LENGTH,
  evaluateAdminPassword,
  isStrongAdminPassword,
  resolveAdminPassword,
};
