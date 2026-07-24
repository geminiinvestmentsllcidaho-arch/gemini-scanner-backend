import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerSignupPage, renderCustomerSignupPageHtml } from "../src/scanner/customer_signup_page.mjs";

test("builds safe customer signup foundation", () => {
  const page = buildCustomerSignupPage();
  assert.equal(page.route, "/signup");
  assert.equal(page.minimumPasswordLength, 12);
  assert.equal(page.accountCreationEnabled, false);
});

test("renders signup fields without enabling account creation", () => {
  const html = renderCustomerSignupPageHtml();
  assert.match(html, /Email address/);
  assert.match(html, /Confirm password/);
  assert.match(html, /Terms of Service/);
  assert.match(html, /type="submit" disabled/);
  assert.doesNotMatch(html, /admin/i);
});

test("renders shared black neon signup theme without changing signup safety gate", () => {
  const html = renderCustomerSignupPageHtml();
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v2"/);
  assert.match(html, /data-gs-surface="public"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
  assert.match(html, /form method="post" action="\/signup"/);
  assert.match(html, /type="submit" disabled/);
  assert.doesNotMatch(html, /\/admin\b|\/app\b|broker|order placement/i);
});

test("signup page loads the password visibility control", () => {
  const html = renderCustomerSignupPageHtml(buildCustomerSignupPage());
  assert.match(html, /<script src="\/customer\/assets\/password-visibility\.js" defer><\/script>/);
});
