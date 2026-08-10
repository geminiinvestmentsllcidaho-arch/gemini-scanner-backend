import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  evaluateAdminPassword,
  isStrongAdminPassword,
  resolveAdminPassword,
} from "../src/scanner/admin_password_auth.mjs";

test("admin password requires a nontrivial minimum-strength secret", () => {
  assert.equal(ADMIN_PASSWORD_MIN_LENGTH, 12);
  assert.equal(isStrongAdminPassword("short"), false);
  assert.equal(isStrongAdminPassword("1234567890123456"), false);
  assert.equal(isStrongAdminPassword("password"), false);
  assert.equal(isStrongAdminPassword("Gemini-Owner-Access-2026"), true);
});

test("admin password resolver accepts explicit configuration", () => {
  assert.equal(
    resolveAdminPassword({ password: "  Gemini-Owner-Access-2026  " }),
    "Gemini-Owner-Access-2026",
  );
});

test("admin password authorization requires the exact configured password", () => {
  const password = "Gemini-Owner-Access-2026";
  const allowed = evaluateAdminPassword(password, { password });
  const denied = evaluateAdminPassword("Gemini-Owner-Access-2027", { password });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.policy, "admin_password_v1");
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "admin_password_required");
});

test("admin password login is disabled without a strong configured password", () => {
  const result = evaluateAdminPassword("anything", { password: "" });
  assert.equal(result.allowed, false);
  assert.equal(result.enabled, false);
  assert.equal(result.reason, "admin_password_disabled");
});
