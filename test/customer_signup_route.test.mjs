import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("server registers gated customer signup routes", () => {
  assert.match(server, /app\.get\(['"]\/signup['"]/);
  assert.match(server, /app\.post\(['"]\/signup['"]/);
  assert.match(server, /CUSTOMER_SIGNUP_ENABLED/);
  assert.match(server, /createCustomerAccountRecord/);
  assert.match(server, /appendCustomerAccountRecord/);
  assert.match(server, /deliverCustomerVerificationEmail/);
  assert.match(server, /findCustomerAccountByEmail/);
});

test("signup POST route keeps explicit safety gate and pending verification", () => {
  assert.match(server, /status\(503\)/);
  assert.match(server, /pending verification|Check your email/i);
  assert.match(server, /limit:\s*['\"]16kb['\"]/);
  assert.match(server, /SIGNUP_RATE_WINDOW_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/);
  assert.match(server, /SIGNUP_RATE_MAX\s*=\s*5/);
  assert.match(server, /signupRateLimited\(req\)/);
  assert.match(server, /status\(429\)/);
  assert.match(server, /Retry-After/);
  assert.doesNotMatch(server, /orderSubmitted\s*:\s*true/);
});

test("server registers customer email verification route", () => {
  assert.match(server, /app\.get\(['"]\/verify-email['"]/);
  assert.match(server, /verifyCustomerEmailToken/);
  assert.match(server, /findCustomerEmailVerificationByTokenHash/);
  assert.match(server, /markCustomerEmailVerified/);
  assert.match(server, /markCustomerEmailVerificationConsumed/);
  assert.match(server, /status\(200\)/);
  assert.match(server, /Email verified/i);
});

test("signup requires configured verification email delivery", () => {
  assert.match(server, /CUSTOMER_EMAIL_PROVIDER/);
  assert.match(server, /RESEND_API_KEY/);
  assert.match(server, /CUSTOMER_EMAIL_FROM/);
  assert.match(server, /Email verification delivery is not configured yet/i);
  assert.match(server, /await deliverCustomerVerificationEmail/);
  assert.match(server, /Verification email delayed/i);
  assert.match(server, /Check your email/i);
});

test("verification route completes pending customer email changes", () => {
  assert.match(server, /findCustomerAccountById\(result\.accountId\)/);
  assert.match(server, /completeCustomerEmailChange\(result\.accountId, result\.email\)/);
  assert.match(server, /Email address changed/);
  assert.match(server, /Sign in again with the new address/);
});
