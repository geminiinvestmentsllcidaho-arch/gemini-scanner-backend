export function requireCustomerSameOrigin(req, res, next) {
  const rawOrigin = String(req.get('origin') ?? '').trim();
  const origin = rawOrigin.toLowerCase() === 'null' ? '' : rawOrigin;
  const referer = String(req.get('referer') ?? '').trim();
  const secFetchSite = String(req.get('sec-fetch-site') ?? '').trim().toLowerCase();
  const forwardedProto = String(req.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
  const source = origin || referer;
  const blocked = () => res.status(403).type('html').send(
    '<!doctype html><html><body><main><h1>Request blocked</h1><p>This request could not be verified.</p><p><a href="/login">Return to sign in</a></p></main></body></html>',
  );

  if (!source) {
    const expectedHost = String(req.get('host') ?? '').trim().toLowerCase();
    const trustedHosts = new Set(['geminiscanner.net', 'www.geminiscanner.net']);
    const sameSiteBrowserRequest = secFetchSite === 'same-origin' || secFetchSite === 'same-site';
    const secureProxyRequest = forwardedProto === 'https';

    if (trustedHosts.has(expectedHost) && sameSiteBrowserRequest && secureProxyRequest) {
      return next();
    }

    return blocked();
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(source);
  } catch {
    return blocked();
  }

  const expectedHost = String(req.get('host') ?? '').trim().toLowerCase();
  const originHost = String(sourceUrl.host ?? '').trim().toLowerCase();
  const trustedHosts = new Set(['geminiscanner.net', 'www.geminiscanner.net']);
  const exactHostMatch = Boolean(expectedHost) && originHost === expectedHost;
  const trustedSameSiteMatch = trustedHosts.has(expectedHost) && trustedHosts.has(originHost);

  if (
    sourceUrl.protocol !== 'https:' ||
    (!exactHostMatch && !trustedSameSiteMatch)
  ) {
    return blocked();
  }

  return next();
}
