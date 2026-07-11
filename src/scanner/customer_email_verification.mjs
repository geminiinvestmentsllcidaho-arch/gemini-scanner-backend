import crypto from "node:crypto";

export const VERSION = "customer_email_verification_v1";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function clean(value) {
  return String(value ?? "").trim();
}

export function createCustomerEmailVerification(account = {}, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : DEFAULT_TTL_MS;
  const token = clean(options.token) || crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  if (!clean(account.id) || !clean(account.email)) {
    throw new Error("verification_account_required");
  }

  return Object.freeze({
    token,
    record: Object.freeze({
      version: VERSION,
      accountId: clean(account.id),
      email: clean(account.email).toLowerCase(),
      tokenHash,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + ttlMs).toISOString(),
      consumedAt: null,
    }),
  });
}

export function verifyCustomerEmailToken(token, record = {}, options = {}) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const suppliedHash = crypto.createHash("sha256").update(clean(token)).digest();
  const expectedHash = Buffer.from(clean(record.tokenHash), "hex");

  if (!clean(token) || expectedHash.length !== suppliedHash.length) {
    return Object.freeze({ ok: false, reason: "invalid_token" });
  }
  if (!crypto.timingSafeEqual(expectedHash, suppliedHash)) {
    return Object.freeze({ ok: false, reason: "invalid_token" });
  }
  if (record.consumedAt) {
    return Object.freeze({ ok: false, reason: "token_consumed" });
  }
  if (!record.expiresAt || nowMs >= Date.parse(record.expiresAt)) {
    return Object.freeze({ ok: false, reason: "token_expired" });
  }

  return Object.freeze({
    ok: true,
    accountId: clean(record.accountId),
    email: clean(record.email).toLowerCase(),
  });
}
