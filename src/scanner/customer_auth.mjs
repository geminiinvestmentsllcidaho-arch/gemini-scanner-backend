import crypto from "node:crypto";
import {
  findCustomerAccountByEmail,
  findCustomerAccountById,
  verifyCustomerPassword,
} from "./customer_account_store.mjs";

export const VERSION = "customer_auth_v1";
export const COOKIE_NAME = "gs_customer_session";

function clean(value) {
  return String(value ?? "").trim();
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function authenticateCustomer(email, password, options = {}) {
  const account = findCustomerAccountByEmail(email, options);
  if (!account) return Object.freeze({ ok: false, reason: "invalid_credentials" });
  if (account.status !== "active" || account.emailVerified !== true) {
    return Object.freeze({ ok: false, reason: "email_not_verified" });
  }
  if (!verifyCustomerPassword(password, account.password)) {
    return Object.freeze({ ok: false, reason: "invalid_credentials" });
  }
  if (account.authenticatorEnabled === true) {
    const verifyCode = options.verifyAuthenticatorCode;
    const code = clean(options.authenticatorCode);
    const authenticatorAccepted = (
      typeof verifyCode === "function"
      && code
      && verifyCode(account.authenticatorSecret, code, options) === true
    );
    if (!authenticatorAccepted) {
      const recoveryCode = clean(options.authenticatorRecoveryCode);
      const consumeRecoveryCode = options.consumeAuthenticatorRecoveryCode;
      const recoveryResult = (
        recoveryCode
        && typeof consumeRecoveryCode === "function"
      )
        ? consumeRecoveryCode(account.id, recoveryCode, options)
        : null;
      if (!recoveryResult?.ok) {
        return Object.freeze({ ok: false, reason: "authenticator_required" });
      }
      return Object.freeze({
        ok: true,
        account: recoveryResult.account ?? account,
        authenticatorRecoveryCodeUsed: true,
        remainingRecoveryCodeCount: recoveryResult.remainingCodeCount,
      });
    }
  }
  return Object.freeze({ ok: true, account });
}

export function createCustomerSessionToken(account, options = {}) {
  const secret = clean(options.secret);
  if (!secret) throw new Error("customer_session_secret_required");
  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const ttlSec = Number(options.ttlSec ?? 86400);
  if (!Number.isFinite(nowSec) || !Number.isFinite(ttlSec) || ttlSec <= 0) {
    throw new Error("customer_session_ttl_invalid");
  }
  const payload = Buffer.from(JSON.stringify({
    sub: account.id,
    role: "customer",
    iat: nowSec,
    exp: nowSec + ttlSec,
  })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyCustomerSessionToken(token, options = {}) {
  const secret = clean(options.secret);
  const [payload, signature] = clean(token).split(".");
  if (!secret || !payload || !signature) return Object.freeze({ ok: false, reason: "invalid_session" });

  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return Object.freeze({ ok: false, reason: "invalid_session" });
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
    const issuedAtSec = Number(data.iat);
    const expiresAtSec = Number(data.exp);
    if (
      data.role !== "customer"
      || !clean(data.sub)
      || !Number.isFinite(nowSec)
      || !Number.isFinite(issuedAtSec)
      || !Number.isFinite(expiresAtSec)
      || issuedAtSec > nowSec
      || expiresAtSec <= issuedAtSec
      || expiresAtSec <= nowSec
    ) {
      return Object.freeze({ ok: false, reason: "expired_session" });
    }
    const account = findCustomerAccountById(data.sub, options);
    if (!account || account.status !== "active" || account.emailVerified !== true) {
      return Object.freeze({ ok: false, reason: "account_unavailable" });
    }
    const passwordChangedAtSec = Math.floor(Date.parse(account.passwordChangedAt || 0) / 1000);
    const sessionsRevokedAtSec = Math.floor(Date.parse(account.sessionsRevokedAt || 0) / 1000);
    if (
      (Number.isFinite(passwordChangedAtSec) && passwordChangedAtSec > 0 && Number(data.iat) < passwordChangedAtSec)
      || (Number.isFinite(sessionsRevokedAtSec) && sessionsRevokedAtSec > 0 && Number(data.iat) <= sessionsRevokedAtSec)
    ) {
      return Object.freeze({ ok: false, reason: "session_revoked" });
    }
    return Object.freeze({ ok: true, account, session: data });
  } catch {
    return Object.freeze({ ok: false, reason: "invalid_session" });
  }
}
