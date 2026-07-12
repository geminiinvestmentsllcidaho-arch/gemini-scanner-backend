import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  COOKIE_NAME,
  authenticateCustomer,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
} from "../src/scanner/customer_auth.mjs";
import {
  appendCustomerAccountRecord,
  createCustomerAccountRecord,
  findCustomerAccountById,
  markCustomerEmailVerified,
  updateCustomerPassword,
  resetCustomerPassword,
  updateCustomerProfile,
  updateCustomerNotificationPreferences,
  updateCustomerDisplayPreferences,
  beginCustomerAuthenticatorSetup,
  confirmCustomerAuthenticatorSetup,
  disableCustomerAuthenticator,
  regenerateCustomerAuthenticatorRecoveryCodes,
  consumeCustomerAuthenticatorRecoveryCode,
  revokeCustomerSessions,
  recordCustomerLogin,
  beginCustomerEmailChange,
  completeCustomerEmailChange,
  buildCustomerDataExport,
  deactivateCustomerAccount,
  permanentlyDeleteCustomerAccount,
} from "../src/scanner/customer_account_store.mjs";

const AUTHENTICATOR_MASTER_KEY = "0123456789abcdef0123456789abcdef";

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

test("revokes existing customer sessions after password change", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    const login = authenticateCustomer(f.record.email, f.password, { storePath: f.storePath });
    assert.equal(login.ok, true);

    const secret = "session-revocation-test-secret";
    const token = createCustomerSessionToken(login.account, {
      secret,
      nowMs: Date.parse("2026-07-12T04:00:00.000Z"),
      ttlSec: 3600,
    });

    const changed = updateCustomerPassword(
      f.record.id,
      f.password,
      "new correct horse battery staple",
      {
        storePath: f.storePath,
        now: "2026-07-12T04:10:00.000Z",
      },
    );
    assert.equal(changed.ok, true);

    const session = verifyCustomerSessionToken(token, {
      secret,
      nowMs: Date.parse("2026-07-12T04:20:00.000Z"),
      storePath: f.storePath,
    });
    assert.equal(session.ok, false);
    assert.equal(session.reason, "session_revoked");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("resets customer password without requiring the old password", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    const tooShort = resetCustomerPassword(
      f.record.id,
      "short",
      { storePath: f.storePath },
    );
    assert.equal(tooShort.ok, false);
    assert.equal(tooShort.reason, "new_password_too_short");

    const same = resetCustomerPassword(
      f.record.id,
      f.password,
      { storePath: f.storePath },
    );
    assert.equal(same.ok, false);
    assert.equal(same.reason, "new_password_must_differ");

    const changed = resetCustomerPassword(
      f.record.id,
      "new recovery password 123",
      {
        storePath: f.storePath,
        now: "2026-07-12T04:20:00.000Z",
      },
    );
    assert.equal(changed.ok, true);
    assert.equal(changed.account.passwordChangedAt, "2026-07-12T04:20:00.000Z");
    assert.equal(authenticateCustomer(f.record.email, f.password, { storePath: f.storePath }).ok, false);
    assert.equal(
      authenticateCustomer(f.record.email, "new recovery password 123", { storePath: f.storePath }).ok,
      true,
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("begins customer email change only after password confirmation", () => {
  const f = fixture();
  try {
    const wrongPassword = beginCustomerEmailChange(
      f.record.id,
      "wrong password",
      "new@example.com",
      { storePath: f.storePath },
    );
    assert.equal(wrongPassword.ok, false);
    assert.equal(wrongPassword.reason, "current_password_incorrect");

    const invalidEmail = beginCustomerEmailChange(
      f.record.id,
      f.password,
      "not-an-email",
      { storePath: f.storePath },
    );
    assert.equal(invalidEmail.ok, false);
    assert.equal(invalidEmail.reason, "valid_email_required");

    const unchanged = beginCustomerEmailChange(
      f.record.id,
      f.password,
      f.record.email,
      { storePath: f.storePath },
    );
    assert.equal(unchanged.ok, false);
    assert.equal(unchanged.reason, "new_email_must_differ");

    const changed = beginCustomerEmailChange(
      f.record.id,
      f.password,
      "New.Email@Example.com",
      {
        storePath: f.storePath,
        now: "2026-07-12T08:15:00.000Z",
      },
    );
    assert.equal(changed.ok, true);
    assert.equal(changed.account.email, "customer@example.com");
    assert.equal(changed.account.pendingEmail, "new.email@example.com");
    assert.equal(changed.account.emailChangeRequestedAt, "2026-07-12T08:15:00.000Z");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("completes customer email change only for the verified pending address", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });

    const begun = beginCustomerEmailChange(
      f.record.id,
      f.password,
      "new.email@example.com",
      {
        storePath: f.storePath,
        now: "2026-07-12T08:15:00.000Z",
      },
    );
    assert.equal(begun.ok, true);

    const mismatch = completeCustomerEmailChange(
      f.record.id,
      "other@example.com",
      { storePath: f.storePath },
    );
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.reason, "pending_email_mismatch");

    const completed = completeCustomerEmailChange(
      f.record.id,
      "NEW.EMAIL@EXAMPLE.COM",
      {
        storePath: f.storePath,
        now: "2026-07-12T08:30:00.000Z",
      },
    );
    assert.equal(completed.ok, true);
    assert.equal(completed.account.email, "new.email@example.com");
    assert.equal(completed.account.previousEmail, "customer@example.com");
    assert.equal(completed.account.emailChangedAt, "2026-07-12T08:30:00.000Z");
    assert.equal(completed.account.sessionsRevokedAt, "2026-07-12T08:30:00.000Z");
    assert.equal("pendingEmail" in completed.account, false);
    assert.equal("emailChangeRequestedAt" in completed.account, false);
    assert.equal(
      authenticateCustomer("customer@example.com", f.password, { storePath: f.storePath }).ok,
      false,
    );
    assert.equal(
      authenticateCustomer("new.email@example.com", f.password, { storePath: f.storePath }).ok,
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
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
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

test("updates customer display preferences with normalized defaults", () => {
  const f = fixture();
  try {
    const updated = updateCustomerDisplayPreferences(
      f.record.id,
      { theme: "dark", density: "compact", locale: "en-CA", timezone: "America/Denver", reducedMotion: "on" },
      { storePath: f.storePath, now: "2026-07-12T01:20:00.000Z" },
    );
    assert.equal(updated.ok, true);
    assert.deepEqual(updated.account.displayPreferences, {
      theme: "dark",
      density: "compact",
      locale: "en-CA",
      timezone: "America/Denver",
      reducedMotion: true,
    });
    assert.equal(
      updated.account.displayPreferencesUpdatedAt,
      "2026-07-12T01:20:00.000Z",
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("starts customer authenticator setup without enabling login enforcement", () => {
  const f = fixture();
  try {
    const started = beginCustomerAuthenticatorSetup(
      f.record.id,
      "GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY, now: "2026-07-12T01:40:00.000Z" },
    );
    assert.equal(started.ok, true);
    assert.equal(started.account.authenticatorEnabled, false);
    assert.equal(
      started.account.authenticatorPendingSecret,
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    );
    assert.equal(
      started.account.authenticatorSetupStartedAt,
      "2026-07-12T01:40:00.000Z",
    );
    const stored = fs.readFileSync(f.storePath, "utf8");
    assert.equal(stored.includes("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), false);
    assert.match(stored, /authenticatorPendingSecretEncrypted/);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("confirms customer authenticator setup only with a valid code", () => {
  const f = fixture();
  try {
    beginCustomerAuthenticatorSetup(
      f.record.id,
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );

    const rejected = confirmCustomerAuthenticatorSetup(
      f.record.id,
      "000000",
      () => false,
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, "invalid_authenticator_code");

    const confirmed = confirmCustomerAuthenticatorSetup(
      f.record.id,
      "287082",
      (secret, code) => secret === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" && code === "287082",
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        now: "2026-07-12T01:50:00.000Z",
        recoveryCodeGenerator: (index) => `ABCDE${String(index).padStart(5, "0")}`,
      },
    );
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.account.authenticatorEnabled, true);
    assert.equal(
      confirmed.account.authenticatorSecret,
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    );
    assert.equal(confirmed.account.authenticatorPendingSecret, null);
    assert.deepEqual(confirmed.account.authenticatorRecoveryCodes, [
      "ABCDE-00000",
      "ABCDE-00001",
      "ABCDE-00002",
      "ABCDE-00003",
      "ABCDE-00004",
      "ABCDE-00005",
      "ABCDE-00006",
      "ABCDE-00007",
    ]);
    const stored = fs.readFileSync(f.storePath, "utf8");
    assert.equal(stored.includes("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), false);
    assert.match(stored, /authenticatorSecretEncrypted/);
    assert.match(stored, /authenticatorRecoveryCodeHashes/);
    assert.equal(stored.includes("ABCDE-00000"), false);
    assert.equal(
      confirmed.account.authenticatorEnabledAt,
      "2026-07-12T01:50:00.000Z",
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("regenerates recovery codes only after password and authenticator verification", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    beginCustomerAuthenticatorSetup(
      f.record.id,
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    confirmCustomerAuthenticatorSetup(
      f.record.id,
      "287082",
      () => true,
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        recoveryCodeGenerator: (index) => `OLDCD${String(index).padStart(5, "0")}`,
      },
    );

    const wrongPassword = regenerateCustomerAuthenticatorRecoveryCodes(
      f.record.id,
      "wrong password",
      "287082",
      () => true,
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(wrongPassword.ok, false);
    assert.equal(wrongPassword.reason, "current_password_incorrect");

    const wrongCode = regenerateCustomerAuthenticatorRecoveryCodes(
      f.record.id,
      f.password,
      "000000",
      () => false,
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(wrongCode.ok, false);
    assert.equal(wrongCode.reason, "invalid_authenticator_code");

    const regenerated = regenerateCustomerAuthenticatorRecoveryCodes(
      f.record.id,
      f.password,
      "287082",
      (secret, code) =>
        secret === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" && code === "287082",
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        recoveryCodeGenerator: (index) => `NEWCD${String(index).padStart(5, "0")}`,
        now: "2026-07-12T03:00:00.000Z",
      },
    );
    assert.equal(regenerated.ok, true);
    assert.equal(regenerated.account.authenticatorRecoveryCodes.length, 8);
    assert.equal(regenerated.account.authenticatorRecoveryCodes[0], "NEWCD-00000");

    const oldCode = consumeCustomerAuthenticatorRecoveryCode(
      f.record.id,
      "OLDCD-00000",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(oldCode.ok, false);

    const newCode = consumeCustomerAuthenticatorRecoveryCode(
      f.record.id,
      "NEWCD-00000",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(newCode.ok, true);

    const stored = fs.readFileSync(f.storePath, "utf8");
    assert.equal(stored.includes("NEWCD-00000"), false);
    assert.equal(stored.includes("OLDCD-00000"), false);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("consumes customer authenticator recovery codes only once", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    beginCustomerAuthenticatorSetup(
      f.record.id,
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    confirmCustomerAuthenticatorSetup(
      f.record.id,
      "287082",
      () => true,
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        recoveryCodeGenerator: (index) => `FGHIJ${String(index).padStart(5, "0")}`,
      },
    );

    const invalid = consumeCustomerAuthenticatorRecoveryCode(
      f.record.id,
      "WRONG-CODE",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(invalid.ok, false);
    assert.equal(invalid.reason, "invalid_recovery_code");

    const consumed = consumeCustomerAuthenticatorRecoveryCode(
      f.record.id,
      "FGHIJ-00000",
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        now: "2026-07-12T02:00:00.000Z",
      },
    );
    assert.equal(consumed.ok, true);
    assert.equal(consumed.remainingCodeCount, 7);
    assert.equal(consumed.account.authenticatorRecoveryCodeUsedAt, "2026-07-12T02:00:00.000Z");

    const reused = consumeCustomerAuthenticatorRecoveryCode(
      f.record.id,
      "FGHIJ-00000",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(reused.ok, false);
    assert.equal(reused.reason, "invalid_recovery_code");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("accepts a single-use recovery code when authenticator code is unavailable", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    beginCustomerAuthenticatorSetup(
      f.record.id,
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    confirmCustomerAuthenticatorSetup(
      f.record.id,
      "287082",
      () => true,
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        recoveryCodeGenerator: (index) => `KLMNO${String(index).padStart(5, "0")}`,
      },
    );

    const accepted = authenticateCustomer(
      f.record.email,
      f.password,
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        authenticatorRecoveryCode: "KLMNO-00000",
        verifyAuthenticatorCode: () => false,
        consumeAuthenticatorRecoveryCode: consumeCustomerAuthenticatorRecoveryCode,
        now: "2026-07-12T02:10:00.000Z",
      },
    );
    assert.equal(accepted.ok, true);
    assert.equal(accepted.authenticatorRecoveryCodeUsed, true);
    assert.equal(accepted.remainingRecoveryCodeCount, 7);

    const reused = authenticateCustomer(
      f.record.email,
      f.password,
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        authenticatorRecoveryCode: "KLMNO-00000",
        verifyAuthenticatorCode: () => false,
        consumeAuthenticatorRecoveryCode: consumeCustomerAuthenticatorRecoveryCode,
      },
    );
    assert.equal(reused.ok, false);
    assert.equal(reused.reason, "authenticator_required");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("requires a valid authenticator code when authenticator is enabled", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    beginCustomerAuthenticatorSetup(
      f.record.id,
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    confirmCustomerAuthenticatorSetup(
      f.record.id,
      "287082",
      () => true,
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );

    const missing = authenticateCustomer(
      f.record.email,
      f.password,
      { storePath: f.storePath, authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY },
    );
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "authenticator_required");

    const accepted = authenticateCustomer(
      f.record.email,
      f.password,
      {
        storePath: f.storePath,
        authenticatorMasterKey: AUTHENTICATOR_MASTER_KEY,
        authenticatorCode: "287082",
        verifyAuthenticatorCode: (secret, code) =>
          secret === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" && code === "287082",
      },
    );
    assert.equal(accepted.ok, true);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test('disables customer authenticator only with current password and valid code', () => {
  const storePath = join(tmpdir(), `customer-auth-disable-${randomUUID()}.jsonl`);
  const authenticatorMasterKey = '0123456789abcdef0123456789abcdef';
  const password = 'Correct-Horse-Battery-99';
  const secret = 'JBSWY3DPEHPK3PXP';
  const account = createCustomerAccountRecord({
    firstName: 'Test',
    lastName: 'Customer',
    email: 'disable@example.com',
    password,
    confirmPassword: password,
    termsAccepted: true,
  });
  appendCustomerAccountRecord(account, { storePath });
  markCustomerEmailVerified(account.id, { storePath, authenticatorMasterKey });
  beginCustomerAuthenticatorSetup(account.id, secret, { storePath, authenticatorMasterKey });
  confirmCustomerAuthenticatorSetup(
    account.id,
    '123456',
    (candidateSecret, code) => candidateSecret === secret && code === '123456',
    { storePath, authenticatorMasterKey },
  );

  const wrongPassword = disableCustomerAuthenticator(
    account.id,
    'wrong-password',
    '123456',
    () => true,
    { storePath, authenticatorMasterKey },
  );
  assert.equal(wrongPassword.ok, false);
  assert.equal(wrongPassword.reason, 'current_password_incorrect');

  const wrongCode = disableCustomerAuthenticator(
    account.id,
    password,
    '000000',
    (_candidateSecret, code) => code === '123456',
    { storePath, authenticatorMasterKey },
  );
  assert.equal(wrongCode.ok, false);
  assert.equal(wrongCode.reason, 'invalid_authenticator_code');

  const disabled = disableCustomerAuthenticator(
    account.id,
    password,
    '123456',
    (candidateSecret, code) => candidateSecret === secret && code === '123456',
    { storePath, authenticatorMasterKey },
  );
  assert.equal(disabled.ok, true);
  assert.equal(disabled.account.authenticatorEnabled, false);

  const raw = readFileSync(storePath, 'utf8');
  assert.doesNotMatch(raw, /authenticatorSecretEncrypted/);
  assert.doesNotMatch(raw, /JBSWY3DPEHPK3PXP/);
});


test("revokes all existing customer sessions on demand", () => {
  const f = fixture();
  try {
    markCustomerEmailVerified(f.record.id, { storePath: f.storePath });
    const login = authenticateCustomer(f.record.email, f.password, { storePath: f.storePath });
    assert.equal(login.ok, true);

    const secret = "sign-out-all-session-secret";
    const token = createCustomerSessionToken(login.account, {
      secret,
      nowMs: Date.parse("2026-07-12T05:00:00.000Z"),
      ttlSec: 3600,
    });

    const revoked = revokeCustomerSessions(f.record.id, {
      storePath: f.storePath,
      now: "2026-07-12T05:05:00.000Z",
    });
    assert.equal(revoked.ok, true);
    assert.equal(revoked.account.sessionsRevokedAt, "2026-07-12T05:05:00.000Z");

    const session = verifyCustomerSessionToken(token, {
      secret,
      nowMs: Date.parse("2026-07-12T05:10:00.000Z"),
      storePath: f.storePath,
    });
    assert.equal(session.ok, false);
    assert.equal(session.reason, "session_revoked");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("records successful customer login security activity", () => {
  const f = fixture();
  try {
    const first = recordCustomerLogin(
      f.record.id,
      {
        ip: "203.0.113.20",
        userAgent: "GeminiScanner Test Browser/1.0",
      },
      {
        storePath: f.storePath,
        now: "2026-07-12T05:30:00.000Z",
      },
    );
    assert.equal(first.ok, true);
    assert.equal(first.account.lastLoginAt, "2026-07-12T05:30:00.000Z");
    assert.equal(first.account.lastLoginIp, "203.0.113.20");
    assert.equal(first.account.lastLoginUserAgent, "GeminiScanner Test Browser/1.0");
    assert.deepEqual(first.account.recentLoginHistory, [
      {
        loginAt: "2026-07-12T05:30:00.000Z",
        ip: "203.0.113.20",
        userAgent: "GeminiScanner Test Browser/1.0",
      },
    ]);
    assert.equal(first.account.loginCount, 1);

    const second = recordCustomerLogin(
      f.record.id,
      {
        ip: "203.0.113.21",
        userAgent: "GeminiScanner Test Browser/2.0",
      },
      {
        storePath: f.storePath,
        now: "2026-07-12T05:35:00.000Z",
      },
    );
    assert.equal(second.ok, true);
    assert.equal(second.account.loginCount, 2);
    assert.equal(second.account.lastLoginIp, "203.0.113.21");
    assert.equal(second.account.recentLoginHistory.length, 2);
    assert.equal(second.account.recentLoginHistory[0].ip, "203.0.113.21");
    assert.equal(second.account.recentLoginHistory[1].ip, "203.0.113.20");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("deactivates customer account only after password confirmation", () => {
  const f = fixture();
  try {
    const wrong = deactivateCustomerAccount(
      f.record.id,
      "wrong password",
      { storePath: f.storePath, now: "2026-07-12T06:00:00.000Z" },
    );
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, "current_password_incorrect");

    const result = deactivateCustomerAccount(
      f.record.id,
      f.password,
      { storePath: f.storePath, now: "2026-07-12T06:00:00.000Z" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.account.status, "deactivated");
    assert.equal(result.account.deactivatedAt, "2026-07-12T06:00:00.000Z");
    assert.equal(result.account.sessionsRevokedAt, "2026-07-12T06:00:00.000Z");
    assert.equal(
      authenticateCustomer(f.record.email, f.password, { storePath: f.storePath }).ok,
      false,
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("builds a customer data export without authentication secrets", () => {
  const f = fixture();
  try {
    const result = buildCustomerDataExport(f.record.id, {
      storePath: f.storePath,
      now: "2026-07-12T10:00:00.000Z",
    });

    assert.equal(result.ok, true);
    assert.equal(result.export.version, "customer-data-export-v1");
    assert.equal(result.export.generatedAt, "2026-07-12T10:00:00.000Z");
    assert.equal(result.export.account.id, f.record.id);
    assert.equal(result.export.account.email, f.record.email);
    assert.equal("password" in result.export.account, false);
    assert.equal("authenticatorSecret" in result.export.account, false);
    assert.equal("authenticatorPendingSecret" in result.export.account, false);
    assert.equal("authenticatorSecretEncrypted" in result.export.account, false);
    assert.equal("authenticatorPendingSecretEncrypted" in result.export.account, false);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});


test("permanently deletes customer account only after password confirmation", () => {
  const f = fixture();
  try {
    const wrong = permanentlyDeleteCustomerAccount(
      f.record.id,
      "wrong password",
      { storePath: f.storePath, now: "2026-07-12T11:00:00.000Z" },
    );
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, "current_password_incorrect");
    assert.notEqual(findCustomerAccountById(f.record.id, { storePath: f.storePath }), null);

    const result = permanentlyDeleteCustomerAccount(
      f.record.id,
      f.password,
      { storePath: f.storePath, now: "2026-07-12T11:05:00.000Z" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.deletedAccountId, f.record.id);
    assert.equal(result.deletedAt, "2026-07-12T11:05:00.000Z");
    assert.equal(findCustomerAccountById(f.record.id, { storePath: f.storePath }), null);
    assert.equal(
      authenticateCustomer(f.record.email, f.password, { storePath: f.storePath }).ok,
      false,
    );
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});
