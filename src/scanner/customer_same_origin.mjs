export function requireCustomerSameOrigin(req, res, next) {
  const origin = String(req.get('origin') ?? '').trim();
  const blocked = () => res.status(403).type('html').send(
    '<!doctype html><html><body><main><h1>Request blocked</h1><p>This request could not be verified.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
  );

  if (!origin) return blocked();

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return blocked();
  }

  const expectedHost = String(req.get('host') ?? '').trim().toLowerCase();
  const originHost = String(originUrl.host ?? '').trim().toLowerCase();
  if (originUrl.protocol !== 'https:' || !expectedHost || originHost !== expectedHost) {
    return blocked();
  }

  return next();
}
