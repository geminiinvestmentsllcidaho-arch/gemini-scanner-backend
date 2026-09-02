import crypto from "node:crypto";

export const VERSION = "customer_report_download_token_v1";
export const CUSTOMER_REPORT_DOWNLOAD_PERIODS = Object.freeze([
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "ytd",
  "lifetime",
]);

const DEFAULT_TTL_SEC = 86400;
const MAX_TTL_SEC = 7 * 86400;

function clean(value) {
  return String(value ?? "").trim();
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function validPeriod(value) {
  return CUSTOMER_REPORT_DOWNLOAD_PERIODS.includes(clean(value).toLowerCase());
}

export function createCustomerReportDownloadToken(input = {}, options = {}) {
  const accountId = clean(input.accountId);
  const period = clean(input.period).toLowerCase();
  const secret = clean(options.secret);
  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const ttlSec = Number(options.ttlSec ?? DEFAULT_TTL_SEC);

  if (!accountId || !validPeriod(period)) {
    throw new Error("customer_report_download_identity_required");
  }
  if (!secret) {
    throw new Error("customer_report_download_secret_required");
  }
  if (
    !Number.isFinite(nowSec)
    || !Number.isFinite(ttlSec)
    || ttlSec <= 0
    || ttlSec > MAX_TTL_SEC
  ) {
    throw new Error("customer_report_download_ttl_invalid");
  }

  const payload = Buffer.from(JSON.stringify({
    sub: accountId,
    period,
    iat: nowSec,
    exp: nowSec + ttlSec,
    purpose: "customer_report_pdf",
  })).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyCustomerReportDownloadToken(token, options = {}) {
  const secret = clean(options.secret);
  const parts = clean(token).split(".");
  if (!secret || parts.length !== 2 || !parts[0] || !parts[1]) {
    return Object.freeze({ ok: false, reason: "invalid_token" });
  }

  const [payload, signature] = parts;
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return Object.freeze({ ok: false, reason: "invalid_token" });
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
    const issuedAtSec = Number(data.iat);
    const expiresAtSec = Number(data.exp);
    const period = clean(data.period).toLowerCase();

    if (
      data.purpose !== "customer_report_pdf"
      || !clean(data.sub)
      || !validPeriod(period)
      || !Number.isFinite(nowSec)
      || !Number.isFinite(issuedAtSec)
      || !Number.isFinite(expiresAtSec)
      || issuedAtSec > nowSec
      || expiresAtSec <= issuedAtSec
      || expiresAtSec <= nowSec
      || expiresAtSec - issuedAtSec > MAX_TTL_SEC
    ) {
      return Object.freeze({ ok: false, reason: "expired_token" });
    }

    return Object.freeze({
      ok: true,
      accountId: clean(data.sub),
      period,
    });
  } catch {
    return Object.freeze({ ok: false, reason: "invalid_token" });
  }
}
