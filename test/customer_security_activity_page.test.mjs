import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerSecurityActivityPage,
  renderCustomerSecurityActivityPageHtml,
} from "../src/scanner/customer_security_activity_page.mjs";

test("builds a customer-only read-only security activity page", () => {
  const page = buildCustomerSecurityActivityPage({
    activity: [{
      eventAt: "2026-07-13T04:45:00.000Z",
      eventLabel: "Password changed",
      outcome: "success",
      ip: "127.0.0.1",
      userAgent: "test-agent",
    }],
  });

  assert.equal(page.route, "/customer/security-activity");
  assert.equal(page.readOnly, true);
  assert.equal(page.customerOnly, true);
  assert.equal(page.activity.length, 1);
});

test("renders account security activity without internal identifiers or admin controls", () => {
  const html = renderCustomerSecurityActivityPageHtml(
    buildCustomerSecurityActivityPage({
      activity: [{
        eventAt: "2026-07-13T04:45:00.000Z",
        eventLabel: "Password changed",
        outcome: "success",
        ip: "127.0.0.1",
        userAgent: "test-agent",
        accountId: "must-not-render",
        reason: "must-not-render",
      }],
    }),
  );

  assert.match(html, /data-page="security-activity"/);
  assert.match(html, /Password changed/);
  assert.match(html, /This history is read-only/);
  assert.doesNotMatch(html, /must-not-render/);
  assert.doesNotMatch(html, /\/admin\b|\/diagnostics\b|\/app\b|broker|place order/i);
});

test("renders customer security activity with shared global neon theme and fixed background logo", () => {
  const html = renderCustomerSecurityActivityPageHtml(
    buildCustomerSecurityActivityPage({
      activity: [{
        eventAt: "2026-07-13T19:00:00.000Z",
        eventLabel: "Sign in",
        outcome: "success",
        ip: "127.0.0.1",
        userAgent: "test",
      }],
    }),
  );
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v4"/);
  assert.match(html, /data-gs-surface="customer"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
  assert.match(html, /data-gs-page="customer-security-activity"/);
  assert.doesNotMatch(html, /\/admin\b/);
});

test("security activity remains secondary under shared Settings navigation", () => {
  const html = renderCustomerSecurityActivityPageHtml(
    buildCustomerSecurityActivityPage({ activity: [] }),
  );

  assert.match(html, /href="\/customer"[^>]*>[\s\S]*?Overview[\s\S]*?<\/a>/);
  assert.match(html, /href="\/customer\/settings"[^>]*aria-current="page"[^>]*>[\s\S]*?Settings[\s\S]*?<\/a>/);
  assert.match(html, /href="\/customer\/settings">Back to Settings<\/a>/);
  assert.match(html, /<span aria-current="page">Security activity<\/span>/);
  assert.doesNotMatch(html, />Home<\/a>|\/customer\/scanner\/under-five/);
});
