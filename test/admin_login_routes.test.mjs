import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const server = fs.readFileSync("src/server.js", "utf8");
const homepage = fs.readFileSync("src/scanner/public_homepage.mjs", "utf8");

test("public splash page exposes dedicated admin sign-in link", () => {
  assert.match(homepage, /public_homepage_v5/);
  assert.match(homepage, /adminSignInHref:\s*"\/admin\/login"/);
  assert.match(homepage, />Admin sign in<\/a>/);
});

test("admin browser login validates the protected operator token and creates isolated session cookie", () => {
  assert.match(server, /app\.get\('\/admin\/login'/);
  assert.match(server, /app\.post\('\/admin\/login', requireCustomerSameOrigin/);
  assert.match(server, /import \{ createRequireAdminAuthorization, evaluateAdminAuthorization \} from '\.\/scanner\/admin_authorization\.mjs';/);
  assert.match(server, /import \{ createAdminLoginRateLimiter \} from '\.\/scanner\/admin_login_rate_limit\.mjs';/);
  assert.match(server, /const adminLoginRateLimiter = createAdminLoginRateLimiter\(\);/);
  assert.doesNotMatch(server, /const adminLoginRateLimiter = createCustomerLoginRateLimiter\(\);/);
  assert.match(server, /evaluateAdminAuthorization\(req\.body\?\.token\)/);
  assert.match(server, /createAdminSessionToken\(\{/);
  assert.match(server, /res\.cookie\(ADMIN_SESSION_COOKIE_NAME, token, buildAdminSessionCookieOptions\(\)\)/);
  assert.match(server, /app\.post\('\/admin\/logout', requireCustomerSameOrigin/);
  assert.match(server, /res\.clearCookie\(ADMIN_SESSION_COOKIE_NAME, buildAdminSessionCookieClearOptions\(\)\)/);
});

test("admin authorization accepts browser session but preserves protected-token fallback", () => {
  assert.match(server, /function requireAdminAuthorization\(req, res, next\)/);
  assert.match(server, /verifyAdminSessionToken\(adminCookieValue\(req\), \{ secret: sessionSecret \}\)/);
  assert.match(server, /return requireAdminTokenAuthorization\(req, res, next\)/);
  assert.match(server, /app\.get\('\/admin', requireAdminAuthorization/);
  assert.match(server, /app\.get\('\/admin\/trading-engine', requireAdminAuthorization/);
  assert.match(server, /app\.post\('\/admin\/alpaca-access', requireAdminAuthorization, requireCustomerSameOrigin/);
});

test("admin login block does not introduce broker submission or execution gates", () => {
  const start = server.indexOf("function adminLoginHtml");
  const end = server.indexOf("app.get('/admin'", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = server.slice(start, end);
  assert.doesNotMatch(block, /\/v2\/orders|submitPaperOrder|cancelOrder|replaceOrder|PAPER_AUTO_|brokerMutationAllowed\s*:\s*true/);
});
