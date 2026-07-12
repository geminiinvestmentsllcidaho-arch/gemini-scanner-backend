import test from "node:test";
import assert from "node:assert/strict";

import {
  customerAuthenticatorCode,
  generateCustomerAuthenticatorSecret,
  verifyCustomerAuthenticatorCode,
} from "../src/scanner/customer_authenticator.mjs";

test("generates deterministic base32 authenticator secrets", () => {
  const secret = generateCustomerAuthenticatorSecret({
    bytes: Buffer.from("12345678901234567890"),
  });
  assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
});

test("matches the RFC 6238 six-digit TOTP vector", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const code = customerAuthenticatorCode(secret, { nowMs: 59_000 });
  assert.equal(code, "287082");
  assert.equal(
    verifyCustomerAuthenticatorCode(secret, code, { nowMs: 59_000, window: 0 }),
    true,
  );
  assert.equal(
    verifyCustomerAuthenticatorCode(secret, "000000", { nowMs: 59_000, window: 0 }),
    false,
  );
});
