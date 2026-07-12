import crypto from "node:crypto";

export const VERSION = "customer_authenticator_secret_crypto_v1";
export const POLICY = "aes_256_gcm_per_customer_authenticator_v1";

function clean(value) {
  return String(value ?? "").trim();
}

function deriveKey(masterKey, accountId) {
  return crypto.scryptSync(
    masterKey,
    `gemini-scanner:customer-authenticator:${accountId}`,
    32,
  );
}

export function encryptCustomerAuthenticatorSecret(secret, options = {}) {
  const normalizedSecret = clean(secret).replaceAll(" ", "").toUpperCase();
  const masterKey = clean(options.masterKey);
  const accountId = clean(options.accountId);

  if (!/^[A-Z2-7]{16,}$/.test(normalizedSecret)) {
    throw new Error("invalid_authenticator_secret");
  }
  if (masterKey.length < 32) {
    throw new Error("authenticator_master_key_too_short");
  }
  if (!accountId) {
    throw new Error("authenticator_account_id_required");
  }

  const iv = options.iv
    ? Buffer.from(options.iv)
    : crypto.randomBytes(12);
  if (iv.length !== 12) {
    throw new Error("authenticator_iv_invalid");
  }

  const key = deriveKey(masterKey, accountId);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(accountId, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(normalizedSecret, "utf8"),
    cipher.final(),
  ]);

  return Object.freeze({
    version: VERSION,
    policy: POLICY,
    algorithm: "aes-256-gcm",
    accountId,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

export function decryptCustomerAuthenticatorSecret(envelope, options = {}) {
  const source = envelope && typeof envelope === "object" ? envelope : {};
  const masterKey = clean(options.masterKey);
  const accountId = clean(options.accountId);

  if (masterKey.length < 32) {
    throw new Error("authenticator_master_key_too_short");
  }
  if (!accountId) {
    throw new Error("authenticator_account_id_required");
  }
  if (clean(source.accountId) !== accountId) {
    throw new Error("authenticator_account_mismatch");
  }

  const key = deriveKey(masterKey, accountId);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(clean(source.iv), "base64"),
  );
  decipher.setAAD(Buffer.from(accountId, "utf8"));
  decipher.setAuthTag(Buffer.from(clean(source.authTag), "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(clean(source.ciphertext), "base64")),
    decipher.final(),
  ]).toString("utf8");
}
