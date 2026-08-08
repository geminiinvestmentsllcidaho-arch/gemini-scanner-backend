import crypto from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "gs_admin_session";
export const ADMIN_SESSION_COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function clean(value) {
  return String(value ?? "").trim();
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSessionToken(options = {}) {
  const secret = clean(options.secret);
  const subject = clean(options.subject || "admin");
  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const ttlSec = Number(options.ttlSec ?? ADMIN_SESSION_COOKIE_MAX_AGE_MS / 1000);

  if (!secret) throw new Error("admin_session_secret_required");
  if (!subject) throw new Error("admin_session_subject_required");
  if (!Number.isFinite(nowSec) || !Number.isFinite(ttlSec) || ttlSec <= 0) {
    throw new Error("admin_session_ttl_invalid");
  }

  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    role: "admin",
    iat: nowSec,
    exp: nowSec + ttlSec,
  })).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSessionToken(token, options = {}) {
  const secret = clean(options.secret);
  const [payload, signature] = clean(token).split(".");
  if (!secret || !payload || !signature) {
    return Object.freeze({ ok: false, reason: "invalid_session" });
  }

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
    if (
      data.role !== "admin"
      || !clean(data.sub)
      || !Number.isFinite(Number(data.iat))
      || !Number.isFinite(Number(data.exp))
      || Number(data.iat) > nowSec
      || Number(data.exp) <= Number(data.iat)
      || Number(data.exp) <= nowSec
    ) {
      return Object.freeze({ ok: false, reason: "expired_session" });
    }

    return Object.freeze({
      ok: true,
      role: "admin",
      subject: data.sub,
      session: Object.freeze(data),
    });
  } catch {
    return Object.freeze({ ok: false, reason: "invalid_session" });
  }
}

export function buildAdminSessionCookieOptions() {
  return Object.freeze({
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    priority: "high",
    maxAge: ADMIN_SESSION_COOKIE_MAX_AGE_MS,
    path: "/admin",
  });
}

export function buildAdminSessionCookieClearOptions() {
  return Object.freeze({
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    priority: "high",
    path: "/admin",
  });
}
