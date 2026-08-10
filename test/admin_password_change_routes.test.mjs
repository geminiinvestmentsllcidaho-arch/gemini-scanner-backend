import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const server = fs.readFileSync("src/server.js", "utf8");

test("admin exposes authenticated self-service password change surface", () => {
  assert.match(server, /app\.get\('\/admin\/security', requireAdminAuthorization/);
  assert.match(server, /app\.post\('\/admin\/security\/password', requireAdminAuthorization, requireCustomerSameOrigin, \(req, res\) =>/);
  assert.match(server, /name="currentPassword"/);
  assert.match(server, /name="newPassword"/);
  assert.match(server, /name="confirmPassword"/);
  assert.match(server, /evaluateAdminPassword\(currentPassword\)\.allowed/);
  assert.match(server, /isStrongAdminPassword\(newPassword\)/);
  assert.match(server, /class=\"admin-security-form\"/);
  assert.match(server, /data-show-passwords/);
});

test("admin password change persists protected env and invalidates sessions", () => {
  assert.match(server, /const serializedAdminPassword = JSON\.stringify\(newPassword\)/);
  assert.match(server, /dotenv\.parse\(`ADMIN_PASSWORD=\$\{serializedAdminPassword\}\\n`\)\.ADMIN_PASSWORD/);
  assert.match(server, /ADMIN_PASSWORD=\$\{serializedAdminPassword\}/);
  assert.match(server, /fs\.chmodSync\(envPath, 0o600\)/);
  assert.match(server, /\/home\/gemini\/\.gemini-scanner-operator-token/);
  assert.match(server, /randomBytes\(32\)\.toString\('hex'\)/);
  assert.match(server, /clearCookie\(ADMIN_SESSION_COOKIE_NAME, buildAdminSessionCookieClearOptions\(\)\)/);
});

test("admin password change block adds no broker or execution action", () => {
  const start = server.indexOf("function adminSecurityHtml");
  const end = server.indexOf("app.get('/admin'", start);
  const block = server.slice(start, end === -1 ? undefined : end);
  assert.doesNotMatch(block, /\/v2\/orders|submitPaperOrder|cancelOrder|replaceOrder|PAPER_AUTO_|brokerMutationAllowed\s*:\s*true/);
});
