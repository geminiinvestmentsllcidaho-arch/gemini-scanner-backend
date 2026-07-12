import test from "node:test";
import assert from "node:assert/strict";

import {
  VERSION,
  createCustomerPasswordReset,
  verifyCustomerPasswordResetToken,
} from "../src/scanner/customer_password_reset.mjs";

test("creates hashed customer password reset record with short expiry", () => {
  const created = createCustomerPasswordReset(
    { id: "customer-1", email: "User@Example.com" },
    {
      token: "fixed-reset-token",
      nowMs: Date.parse("2026-07-12T04:00:00.000Z"),
    },
  );

  assert.equal(created.record.version, VERSION);
  assert.equal(created.record.accountId, "customer-1");
  assert.equal(created.record.email, "user@example.com");
  assert.equal(created.record.createdAt, "2026-07-12T04:00:00.000Z");
  assert.equal(created.record.expiresAt, "2026-07-12T04:30:00.000Z");
  assert.equal(created.record.consumedAt, null);
  assert.notEqual(created.record.tokenHash, created.token);
  assert.doesNotMatch(JSON.stringify(created.record), /fixed-reset-token/);
});

test("verifies valid reset token and rejects invalid expired or consumed token", () => {
  const created = createCustomerPasswordReset(
    { id: "customer-2", email: "reset@example.com" },
    {
      token: "valid-reset-token",
      nowMs: Date.parse("2026-07-12T04:00:00.000Z"),
    },
  );

  const valid = verifyCustomerPasswordResetToken(
    created.token,
    created.record,
    { nowMs: Date.parse("2026-07-12T04:10:00.000Z") },
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.accountId, "customer-2");

  assert.equal(
    verifyCustomerPasswordResetToken("wrong-token", created.record).reason,
    "invalid_token",
  );
  assert.equal(
    verifyCustomerPasswordResetToken(
      created.token,
      created.record,
      { nowMs: Date.parse("2026-07-12T04:30:00.000Z") },
    ).reason,
    "token_expired",
  );
  assert.equal(
    verifyCustomerPasswordResetToken(
      created.token,
      { ...created.record, consumedAt: "2026-07-12T04:05:00.000Z" },
    ).reason,
    "token_consumed",
  );
});
