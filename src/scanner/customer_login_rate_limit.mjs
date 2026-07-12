export const CUSTOMER_LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const CUSTOMER_LOGIN_RATE_MAX_PER_IP = 30;
export const CUSTOMER_LOGIN_RATE_MAX_PER_EMAIL = 10;

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function requestIp(req) {
  return clean(req?.ip || req?.socket?.remoteAddress || 'unknown');
}

function requestEmail(req) {
  return clean(req?.body?.email || 'unknown');
}

export function customerLoginRateLimitKeys(req) {
  return {
    ip: `ip:${requestIp(req)}`,
    email: `email:${requestEmail(req)}`,
  };
}

function hitBucket(buckets, key, nowMs, windowMs, maxAttempts) {
  const current = buckets.get(key);

  if (!current || nowMs - current.windowStart >= windowMs) {
    buckets.set(key, { windowStart: nowMs, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > maxAttempts;
}

export function createCustomerLoginRateLimiter({
  windowMs = CUSTOMER_LOGIN_RATE_WINDOW_MS,
  maxAttemptsPerIp = CUSTOMER_LOGIN_RATE_MAX_PER_IP,
  maxAttemptsPerEmail = CUSTOMER_LOGIN_RATE_MAX_PER_EMAIL,
} = {}) {
  const ipAttempts = new Map();
  const emailAttempts = new Map();

  function isLimited(req, nowMs = Date.now()) {
    const keys = customerLoginRateLimitKeys(req);
    const ipLimited = hitBucket(ipAttempts, keys.ip, nowMs, windowMs, maxAttemptsPerIp);
    if (ipLimited) return true;

    return hitBucket(emailAttempts, keys.email, nowMs, windowMs, maxAttemptsPerEmail);
  }

  function clear(req) {
    const keys = customerLoginRateLimitKeys(req);
    emailAttempts.delete(keys.email);
  }

  return { isLimited, clear };
}
