import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  decryptCustomerAuthenticatorSecret,
  encryptCustomerAuthenticatorSecret,
} from "./customer_authenticator_secret_crypto.mjs";

export const VERSION = "customer_account_store_v1";
const DEFAULT_STORE_PATH = path.resolve("runs/customer_accounts.jsonl");

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeCustomerEmail(value) {
  return clean(value).toLowerCase();
}

export function validateSignupInput(input = {}) {
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const email = normalizeCustomerEmail(input.email);
  const password = String(input.password ?? "");
  const confirmPassword = String(input.confirmPassword ?? "");
  const errors = [];

  if (!firstName) errors.push("first_name_required");
  if (!lastName) errors.push("last_name_required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("valid_email_required");
  if (password.length < 12) errors.push("password_too_short");
  if (password !== confirmPassword) errors.push("passwords_do_not_match");
  if (input.termsAccepted !== true && input.termsAccepted !== "on") errors.push("terms_required");

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    value: Object.freeze({ firstName, lastName, email }),
  });
}

export function hashCustomerPassword(password, salt = crypto.randomBytes(16)) {
  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt), "base64");
  const derived = crypto.scryptSync(String(password), saltBuffer, 64);
  return Object.freeze({
    algorithm: "scrypt",
    salt: saltBuffer.toString("base64"),
    hash: derived.toString("base64"),
  });
}

export function verifyCustomerPassword(password, record = {}) {
  const expected = Buffer.from(clean(record.hash), "base64");
  const actual = crypto.scryptSync(String(password), Buffer.from(clean(record.salt), "base64"), expected.length);
  return expected.length > 0 && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createCustomerAccountRecord(input = {}, options = {}) {
  const validation = validateSignupInput(input);
  if (!validation.ok) {
    const error = new Error("invalid_signup");
    error.codes = validation.errors;
    throw error;
  }

  const password = hashCustomerPassword(input.password);
  return Object.freeze({
    version: VERSION,
    id: crypto.randomUUID(),
    role: "customer",
    firstName: validation.value.firstName,
    lastName: validation.value.lastName,
    email: validation.value.email,
    password,
    emailVerified: false,
    authenticatorEnabled: false,
    status: "pending_email_verification",
    createdAt: options.now ?? new Date().toISOString(),
  });
}

export function listCustomerAccountRecords(options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  if (!fs.existsSync(storePath)) return Object.freeze([]);
  const masterKey = clean(options.authenticatorMasterKey || process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY);
  const records = fs.readFileSync(storePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((record) => {
      const accountId = clean(record.id);
      const next = { ...record };
      if (record.authenticatorPendingSecretEncrypted) {
        next.authenticatorPendingSecret = decryptCustomerAuthenticatorSecret(
          record.authenticatorPendingSecretEncrypted,
          { masterKey, accountId },
        );
      }
      if (record.authenticatorSecretEncrypted) {
        next.authenticatorSecret = decryptCustomerAuthenticatorSecret(
          record.authenticatorSecretEncrypted,
          { masterKey, accountId },
        );
      }
      return next;
    });
  return Object.freeze(records);
}

export function findCustomerAccountByEmail(email, options = {}) {
  const normalized = normalizeCustomerEmail(email);
  return [...listCustomerAccountRecords(options)]
    .reverse()
    .find((record) => record.email === normalized) ?? null;
}

export function findCustomerAccountById(accountId, options = {}) {
  const normalized = clean(accountId);
  return [...listCustomerAccountRecords(options)]
    .reverse()
    .find((record) => clean(record.id) === normalized) ?? null;
}

export function markCustomerEmailVerified(accountId, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  records[index] = {
    ...records[index],
    emailVerified: true,
    status: "active",
    emailVerifiedAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({ ok: true, account: Object.freeze(records[index]) });
}

export function updateCustomerPassword(accountId, currentPassword, newPassword, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  const account = records[index];
  if (!verifyCustomerPassword(currentPassword, account.password)) {
    return Object.freeze({ ok: false, reason: "current_password_incorrect" });
  }
  if (String(newPassword ?? "").length < 12) {
    return Object.freeze({ ok: false, reason: "new_password_too_short" });
  }
  if (verifyCustomerPassword(newPassword, account.password)) {
    return Object.freeze({ ok: false, reason: "new_password_must_differ" });
  }

  records[index] = {
    ...account,
    password: hashCustomerPassword(newPassword),
    passwordChangedAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({ ok: true, account: Object.freeze(records[index]) });
}


export function updateCustomerProfile(accountId, input = {}, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  if (!firstName) return Object.freeze({ ok: false, reason: "first_name_required" });
  if (!lastName) return Object.freeze({ ok: false, reason: "last_name_required" });

  records[index] = {
    ...records[index],
    firstName,
    lastName,
    profileUpdatedAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({ ok: true, account: Object.freeze(records[index]) });
}


export function updateCustomerNotificationPreferences(accountId, input = {}, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  const preferences = Object.freeze({
    scannerAlerts: input.scannerAlerts === true || input.scannerAlerts === "on",
    accountSecurityEmails: true,
    productUpdates: input.productUpdates === true || input.productUpdates === "on",
  });

  records[index] = {
    ...records[index],
    notificationPreferences: preferences,
    notificationPreferencesUpdatedAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({ ok: true, account: Object.freeze(records[index]) });
}


export function updateCustomerDisplayPreferences(accountId, input = {}, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  const theme = ["system", "dark", "light"].includes(clean(input.theme))
    ? clean(input.theme)
    : "system";
  const density = ["comfortable", "compact"].includes(clean(input.density))
    ? clean(input.density)
    : "comfortable";

  records[index] = {
    ...records[index],
    displayPreferences: Object.freeze({
      theme,
      density,
      reducedMotion: input.reducedMotion === true || input.reducedMotion === "on",
    }),
    displayPreferencesUpdatedAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({ ok: true, account: Object.freeze(records[index]) });
}


export function beginCustomerAuthenticatorSetup(accountId, secret, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  const normalizedSecret = clean(secret).replaceAll(" ", "").toUpperCase();
  if (!/^[A-Z2-7]{16,}$/.test(normalizedSecret)) {
    return Object.freeze({ ok: false, reason: "invalid_authenticator_secret" });
  }

  const authenticatorMasterKey = clean(
    options.authenticatorMasterKey || process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
  );
  const encryptedPendingSecret = encryptCustomerAuthenticatorSecret(normalizedSecret, {
    masterKey: authenticatorMasterKey,
    accountId: records[index].id,
  });

  records[index] = {
    ...records[index],
    authenticatorEnabled: false,
    authenticatorPendingSecretEncrypted: encryptedPendingSecret,
    authenticatorPendingSecret: undefined,
    authenticatorSetupStartedAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({
    ok: true,
    account: Object.freeze({
      ...records[index],
      authenticatorPendingSecret: normalizedSecret,
    }),
  });
}


export function confirmCustomerAuthenticatorSetup(accountId, code, verifyCode, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  const account = records[index];
  const authenticatorMasterKey = clean(
    options.authenticatorMasterKey || process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
  );
  const secret = account.authenticatorPendingSecretEncrypted
    ? decryptCustomerAuthenticatorSecret(account.authenticatorPendingSecretEncrypted, {
        masterKey: authenticatorMasterKey,
        accountId: account.id,
      })
    : clean(account.authenticatorPendingSecret);
  if (!secret) {
    return Object.freeze({ ok: false, reason: "authenticator_setup_not_started" });
  }
  if (typeof verifyCode !== "function" || verifyCode(secret, code, options) !== true) {
    return Object.freeze({ ok: false, reason: "invalid_authenticator_code" });
  }

  records[index] = {
    ...account,
    authenticatorEnabled: true,
    authenticatorSecretEncrypted: encryptCustomerAuthenticatorSecret(secret, {
      masterKey: authenticatorMasterKey,
      accountId: account.id,
    }),
    authenticatorPendingSecretEncrypted: null,
    authenticatorSecret: undefined,
    authenticatorPendingSecret: undefined,
    authenticatorEnabledAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({
    ok: true,
    account: Object.freeze({
      ...records[index],
      authenticatorSecret: secret,
      authenticatorPendingSecret: null,
    }),
  });
}


export function disableCustomerAuthenticator(accountId, currentPassword, code, verifyCode, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerAccountRecords({ storePath, authenticatorMasterKey: options.authenticatorMasterKey })];
  const index = records.findIndex((record) => clean(record.id) === clean(accountId));
  if (index < 0) return Object.freeze({ ok: false, reason: "account_not_found" });

  const account = records[index];
  if (account.authenticatorEnabled !== true || !clean(account.authenticatorSecret)) {
    return Object.freeze({ ok: false, reason: "authenticator_not_enabled" });
  }
  if (!verifyCustomerPassword(currentPassword, account.password)) {
    return Object.freeze({ ok: false, reason: "current_password_incorrect" });
  }
  if (typeof verifyCode !== "function" || verifyCode(account.authenticatorSecret, code, options) !== true) {
    return Object.freeze({ ok: false, reason: "invalid_authenticator_code" });
  }

  records[index] = {
    ...account,
    authenticatorEnabled: false,
    authenticatorSecretEncrypted: undefined,
    authenticatorPendingSecretEncrypted: undefined,
    authenticatorSecret: undefined,
    authenticatorPendingSecret: undefined,
    authenticatorDisabledAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);

  return Object.freeze({ ok: true, account: Object.freeze(records[index]) });
}

export function appendCustomerAccountRecord(record, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.appendFileSync(storePath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(storePath, 0o600);
  return Object.freeze({ ok: true, storePathLabel: path.basename(storePath) });
}
