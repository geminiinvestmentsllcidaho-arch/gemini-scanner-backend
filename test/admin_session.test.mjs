import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SESSION_COOKIE_MAX_AGE_MS,
  ADMIN_SESSION_COOKIE_NAME,
  buildAdminSessionCookieClearOptions,
  buildAdminSessionCookieOptions,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "../src/scanner/admin_session.mjs";

const secret = "admin-session-test-secret-1234567890";

test("admin browser session is signed, role-isolated, and expiring", () => {
  const nowMs = Date.parse("2026-08-08T00:20:00.000Z");
  const token = createAdminSessionToken({ secret, subject: "owner", nowMs, ttlSec: 10 });
  const valid = verifyAdminSessionToken(token, { secret, nowMs: nowMs + 1000 });
  assert.equal(valid.ok, true);
  assert.equal(valid.role, "admin");
  assert.equal(valid.subject, "owner");
  assert.equal(valid.session.role, "admin");
  assert.notEqual(ADMIN_SESSION_COOKIE_NAME, "gs_customer_session");
  assert.equal(verifyAdminSessionToken(token, { secret: `${secret}-wrong`, nowMs: nowMs + 1000 }).ok, false);
  assert.equal(verifyAdminSessionToken(token, { secret, nowMs: nowMs + 11000 }).reason, "expired_session");
});

test("admin cookie is secure and scoped to admin paths", () => {
  const options = buildAdminSessionCookieOptions();
  const clear = buildAdminSessionCookieClearOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "strict");
  assert.equal(options.priority, "high");
  assert.equal(options.path, "/admin");
  assert.equal(options.maxAge, ADMIN_SESSION_COOKIE_MAX_AGE_MS);
  assert.equal(clear.httpOnly, true);
  assert.equal(clear.secure, true);
  assert.equal(clear.sameSite, "strict");
  assert.equal(clear.path, "/admin");
});
