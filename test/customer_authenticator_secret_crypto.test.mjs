import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptCustomerAuthenticatorSecret,
  encryptCustomerAuthenticatorSecret,
} from "../src/scanner/customer_authenticator_secret_crypto.mjs";

const MASTER_KEY = "0123456789abcdef0123456789abcdef";
const ACCOUNT_ID = "customer-test-1";
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("encrypts customer authenticator secret without plaintext exposure", () => {
  const envelope = encryptCustomerAuthenticatorSecret(SECRET, {
    masterKey: MASTER_KEY,
    accountId: ACCOUNT_ID,
    iv: Buffer.alloc(12, 7),
  });

  assert.equal(envelope.algorithm, "aes-256-gcm");
  assert.equal(envelope.accountId, ACCOUNT_ID);
  assert.equal(JSON.stringify(envelope).includes(SECRET), false);
  assert.equal(
    decryptCustomerAuthenticatorSecret(envelope, {
      masterKey: MASTER_KEY,
      accountId: ACCOUNT_ID,
    }),
    SECRET,
  );
});

test("customer authenticator secret envelope is bound to exact account", () => {
  const envelope = encryptCustomerAuthenticatorSecret(SECRET, {
    masterKey: MASTER_KEY,
    accountId: ACCOUNT_ID,
    iv: Buffer.alloc(12, 9),
  });

  assert.throws(
    () => decryptCustomerAuthenticatorSecret(envelope, {
      masterKey: MASTER_KEY,
      accountId: "customer-test-2",
    }),
    /authenticator_account_mismatch/,
  );
});
