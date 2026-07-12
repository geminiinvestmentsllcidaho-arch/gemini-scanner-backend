export const CUSTOMER_LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const CUSTOMER_LOGIN_RATE_MAX = 10;

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function requestIp(req) {
  return clean(req?.ip || req?.socket?.remoteAddress || 'unknown');
}

function requestEmail(req) {
  return clean(req?.body?.email || 'unknown');
}

export function customerLoginRateLimitKey(req) {
  return `${requestIp(req)}|${requestEmail(req)}`;
}

export function createCustomerLoginRateLimiter({
  windowMs = CUSTOMER_LOGIN_RATE_WINDOW_MS,
  maxAttempts = CUSTOMER_LOGIN_RATE_MAX,
} = {}) {
  const attempts = new Map();

  function isLimited(req, nowMs = Date.now()) {
    const key = customerLoginRateLimitKey(req);
    const current = attempts.get(key);

    if (!current || nowMs - current.windowStart >= windowMs) {
      attempts.set(key, { windowStart: nowMs, count: 1 });
      return false;
    }

    current.count += 1;
    return current.count > maxAttempts;
  }

  function clear(req) {
    attempts.delete(customerLoginRateLimitKey(req));
  }

  return { isLimited, clear };
}
