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
