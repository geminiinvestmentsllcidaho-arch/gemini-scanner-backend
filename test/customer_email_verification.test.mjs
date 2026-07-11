import test from "node:test";
import assert from "node:assert/strict";

import {
  createCustomerEmailVerification,
  verifyCustomerEmailToken,
} from "../src/scanner/customer_email_verification.mjs";

test("creates hashed customer email verification record", () => {
  const created = createCustomerEmailVerification(
    { id: "acct-1", email: "Zero@Example.com" },
    { nowMs: 1_000, ttlMs: 60_000, token: "test-token" },
  );

  assert.equal(created.token, "test-token");
  assert.equal(created.record.accountId, "acct-1");
  assert.equal(created.record.email, "zero@example.com");
  assert.equal(created.record.tokenHash.includes("test-token"), false);
  assert.equal(created.record.createdAt, "1970-01-01T00:00:01.000Z");
  assert.equal(created.record.expiresAt, "1970-01-01T00:01:01.000Z");
});

test("verifies valid token and rejects invalid expired or consumed token", () => {
  const created = createCustomerEmailVerification(
    { id: "acct-1", email: "zero@example.com" },
    { nowMs: 1_000, ttlMs: 60_000, token: "test-token" },
  );

  assert.deepEqual(
    verifyCustomerEmailToken("test-token", created.record, { nowMs: 2_000 }),
    { ok: true, accountId: "acct-1", email: "zero@example.com" },
   );
  assert.equal(verifyCustomerEmailToken("wrong", created.record, { nowMs: 2_000 }).reason, "invalid_token");
  assert.equal(verifyCustomerEmailToken("test-token", created.record, { nowMs: 61_000 }).reason, "token_expired");
  assert.equal(
    verifyCustomerEmailToken(
      "test-token",
      { ...created.record, consumedAt: "1970-01-01T00:00:02.000Z" },
      { nowMs: 2_000 },
    ).reason,
    "token_consumed",
  );
});
