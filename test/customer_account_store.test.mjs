import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendCustomerAccountRecord,
  createCustomerAccountRecord,
  hashCustomerPassword,
  normalizeCustomerEmail,
  validateSignupInput,
  verifyCustomerPassword,
} from "../src/scanner/customer_account_store.mjs";

test("normalizes and validates signup input", () => {
  assert.equal(normalizeCustomerEmail("  Test@Example.COM "), "test@example.com");
  const result = validateSignupInput({
    firstName: "Zero",
    lastName: "Customer",
    email: "zero@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  });
  assert.equal(result.ok, true);
});

test("rejects weak or mismatched signup input", () => {
  const result = validateSignupInput({
    firstName: "",
    lastName: "",
    email: "bad",
    password: "short",
    confirmPassword: "different",
    termsAccepted: false,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("password_too_short"));
  assert.ok(result.errors.includes("terms_required"));
});

test("hashes and verifies passwords without storing plaintext", () => {
  const password = hashCustomerPassword("correct horse battery staple", Buffer.alloc(16, 7));
  assert.equal(password.algorithm, "scrypt");
  assert.equal(verifyCustomerPassword("correct horse battery staple", password), true);
  assert.equal(verifyCustomerPassword("wrong password", password), false);
  assert.equal(JSON.stringify(password).includes("correct horse"), false);
});

test("creates pending customer record and stores it with private permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-account-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const record = createCustomerAccountRecord({
    firstName: "Zero",
    lastName: "Customer",
    email: "ZERO@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  }, { now: "2026-07-10T20:00:00.000Z" });

  assert.equal(record.role, "customer");
  assert.equal(record.email, "zero@example.com");
  assert.equal(record.status, "pending_email_verification");
  assert.equal(record.emailVerified, false);
  assert.equal(record.authenticatorEnabled, false);
  assert.equal(JSON.stringify(record).includes("correct horse"), false);

  appendCustomerAccountRecord(record, { storePath });
  assert.equal(fs.existsSync(storePath), true);
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
});
