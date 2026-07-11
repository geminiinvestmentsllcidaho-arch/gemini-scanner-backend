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
  return Object.freeze({ ok: true, account });
}

export function createCustomerSessionToken(account, options = {}) {
  const secret = clean(options.secret);
  if (!secret) throw new Error("customer_session_secret_required");
  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const ttlSec = Number(options.ttlSec ?? 86400);
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
    if (data.role !== "customer" || !data.sub || Number(data.exp) <= nowSec) {
      return Object.freeze({ ok: false, reason: "expired_session" });
    }
    const account = findCustomerAccountById(data.sub, options);
    if (!account || account.status !== "active" || account.emailVerified !== true) {
      return Object.freeze({ ok: false, reason: "account_unavailable" });
    }
    return Object.freeze({ ok: true, account, session: data });
  } catch {
    return Object.freeze({ ok: false, reason: "invalid_session" });
  }
}
