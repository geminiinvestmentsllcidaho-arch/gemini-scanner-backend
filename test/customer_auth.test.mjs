import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  COOKIE_NAME,
  authenticateCustomer,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
} from "../src/scanner/customer_auth.mjs";
import {
  appendCustomerAccountRecord,
  createCustomerAccountRecord,
  markCustomerEmailVerified,
  updateCustomerPassword,
  updateCustomerProfile,
  updateCustomerNotificationPreferences,
} from "../src/scanner/customer_account_store.mjs";

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-customer-auth-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const password = "correct horse battery staple";
  const record = createCustomerAccountRecord({
    firstName: "Test",
    lastName: "Customer",
    email: "customer@example.com",
    password,
    confirmPassword: password,
    termsAccepted: "on",
  });
  appendCustomerAccountRecord(record, { storePath });
  return { dir, storePath, password, record };
}

test("rejects login before email verification", () => {
  const f = fixture();
  try {
    const result = authenticateCustomer(f.record.email, f.password, { storePath: f.storePath });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "email_not_verified");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("authenticates verified customer and validates signed session", () => {
  const f = fixture();
  try {
    assert.equal(markCustomerEmailVerified(f.record.id, { storePath: f.storePath }).ok, true);
    const login = authenticateCustomer(f.record.email, f.password, { storePath: f.storePath });
    assert.equal(login.ok, true);

    const secret = "test-session-secret-1234567890";
    const token = createCustomerSessionToken(login.account, {
      secret,
      nowMs: 1_700_000_000_000,
      ttlSec: 3600,
    });
    const session = verifyCustomerSessionToken(token, {
      secret,
      nowMs: 1_700_000_100_000,
      storePath: f.storePath,
    });
    assert.equal(session.ok, true);
    assert.equal(session.account.id, f.record.id);
    assert.equal(COOKIE_NAME, "gs_customer_session");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("rejects wrong password and tampered session token", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    const badLogin = authenticateCustomer(f.record.email, "wrong password", { storePath: f.storePath });
    assert.equal(badLogin.ok, false);
    assert.equal(badLogin.reason, "invalid_credentials");

    const login = authenticateCustomer(f.record.email, f.password, { storePath: f.storePath });
    const token = createCustomerSessionToken(login.account, { secret: "secret-value" });
    const tampered = `${token.slice(0, -1)}x`;
    assert.equal(
      verifyCustomerSessionToken(tampered, {
        secret: "secret-value",
        storePath: f.storePath,
      }).ok,
      false,
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("changes password only after current-password confirmation", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });

    const rejected = updateCustomerPassword(
      f.record.id,
      "wrong current password",
      "new correct horse battery staple",
      { storePath: f.storePath, now: "2026-07-11T22:50:00.000Z" },
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, "current_password_incorrect");

    const changed = updateCustomerPassword(
      f.record.id,
      f.password,
      "new correct horse battery staple",
      { storePath: f.storePath, now: "2026-07-11T22:50:00.000Z" },
    );
    assert.equal(changed.ok, true);
    assert.equal(changed.account.passwordChangedAt, "2026-07-11T22:50:00.000Z");

    assert.equal(
      authenticateCustomer(f.record.email, f.password, { storePath: f.storePath }).ok,
      false,
    );
    assert.equal(
      authenticateCustomer(
        f.record.email,
        "new correct horse battery staple",
        { storePath: f.storePath },
      ).ok,
      true,
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("updates customer profile names with validation", () => {
  const f = fixture();
  try {
    const rejected = updateCustomerProfile(
      f.record.id,
      { firstName: "", lastName: "Operator" },
      { storePath: f.storePath },
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, "first_name_required");

    const updated = updateCustomerProfile(
      f.record.id,
      { firstName: "Gemini", lastName: "Operator" },
      { storePath: f.storePath, now: "2026-07-12T00:05:00.000Z" },
    );
    assert.equal(updated.ok, true);
    assert.equal(updated.account.firstName, "Gemini");
    assert.equal(updated.account.lastName, "Operator");
    assert.equal(updated.account.profileUpdatedAt, "2026-07-12T00:05:00.000Z");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("updates customer notification preferences with security emails locked on", () => {
  const f = fixture();
  try {
    const updated = updateCustomerNotificationPreferences(
      f.record.id,
      { scannerAlerts: "on", productUpdates: false },
      { storePath: f.storePath, now: "2026-07-12T00:25:00.000Z" },
    );
    assert.equal(updated.ok, true);
    assert.deepEqual(updated.account.notificationPreferences, {
      scannerAlerts: true,
      accountSecurityEmails: true,
      productUpdates: false,
    });
    assert.equal(
      updated.account.notificationPreferencesUpdatedAt,
      "2026-07-12T00:25:00.000Z",
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});
