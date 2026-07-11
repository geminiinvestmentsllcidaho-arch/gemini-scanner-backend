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
