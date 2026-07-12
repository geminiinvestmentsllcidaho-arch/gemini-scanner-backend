export const CUSTOMER_SIGNUP_RATE_WINDOW_MS = 15 * 60 * 1000;
export const CUSTOMER_SIGNUP_RATE_MAX_PER_IP = 5;
export const CUSTOMER_SIGNUP_RATE_MAX_BUCKETS = 10000;

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function customerSignupRateLimitKey(req) {
  return `ip:${clean(req?.ip || req?.socket?.remoteAddress || 'unknown')}`;
}

function pruneBuckets(buckets, nowMs, windowMs, maxBuckets) {
  for (const [key, value] of buckets) {
    if (nowMs - value.windowStart >= windowMs) buckets.delete(key);
  }

  while (buckets.size >= maxBuckets) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

export function createCustomerSignupRateLimiter({
  windowMs = CUSTOMER_SIGNUP_RATE_WINDOW_MS,
  maxAttemptsPerIp = CUSTOMER_SIGNUP_RATE_MAX_PER_IP,
  maxBuckets = CUSTOMER_SIGNUP_RATE_MAX_BUCKETS,
} = {}) {
  const attempts = new Map();

  function isLimited(req, nowMs = Date.now()) {
    const key = customerSignupRateLimitKey(req);
    const current = attempts.get(key);

    if (!current || nowMs - current.windowStart >= windowMs) {
      pruneBuckets(attempts, nowMs, windowMs, maxBuckets);
      attempts.set(key, { windowStart: nowMs, count: 1 });
      return false;
    }

    current.count += 1;
    return current.count > maxAttemptsPerIp;
  }

  return { isLimited };
}
