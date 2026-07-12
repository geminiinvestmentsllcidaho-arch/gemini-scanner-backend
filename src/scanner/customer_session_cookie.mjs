export const CUSTOMER_SESSION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function buildCustomerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    priority: 'high',
    maxAge: CUSTOMER_SESSION_COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

export function buildCustomerSessionCookieClearOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    priority: 'high',
    path: '/',
  };
}
