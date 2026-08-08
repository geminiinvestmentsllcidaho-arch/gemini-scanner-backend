export const ADMIN_LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_LOGIN_RATE_MAX_PER_IP = 10;
export const ADMIN_LOGIN_RATE_MAX_BUCKETS = 10000;

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

function requestIp(req) {
  return clean(req?.ip || req?.socket?.remoteAddress || 'unknown');
}

export function adminLoginRateLimitKey(req) {
  return `ip:${requestIp(req)}`;
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

export function createAdminLoginRateLimiter({
  windowMs = ADMIN_LOGIN_RATE_WINDOW_MS,
  maxAttemptsPerIp = ADMIN_LOGIN_RATE_MAX_PER_IP,
  maxBuckets = ADMIN_LOGIN_RATE_MAX_BUCKETS,
} = {}) {
  const ipAttempts = new Map();

  function isLimited(req, nowMs = Date.now()) {
    const key = adminLoginRateLimitKey(req);
    const current = ipAttempts.get(key);

    if (!current || nowMs - current.windowStart >= windowMs) {
      pruneBuckets(ipAttempts, nowMs, windowMs, maxBuckets);
      ipAttempts.set(key, { windowStart: nowMs, count: 1 });
      return false;
    }

    current.count += 1;
    return current.count > maxAttemptsPerIp;
  }

  function clear() {
    // Deliberately preserve source-IP attempt history after successful login.
  }

  return { isLimited, clear };
}

export default {
  createAdminLoginRateLimiter,
  adminLoginRateLimitKey,
};
