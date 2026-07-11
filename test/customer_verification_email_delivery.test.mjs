import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerVerificationEmail,
  deliverCustomerVerificationEmail,
} from "../src/scanner/customer_verification_email_delivery.mjs";

test("builds customer verification email with encoded token", () => {
  const message = buildCustomerVerificationEmail({
    email: " Zero@Example.COM ",
    token: "abc 123",
    baseUrl: "https://geminiscanner.net/",
  });

  assert.equal(message.to, "zero@example.com");
  assert.equal(message.subject, "Verify your GeminiScanner email");
  assert.equal(
    message.verifyUrl,
    "https://geminiscanner.net/verify-email?token=abc%20123",
  );
  assert.match(message.text, /expires in 24 hours/i);
});

test("fails closed when email provider is not configured", async () => {
  const result = await deliverCustomerVerificationEmail({
    email: "zero@example.com",
    token: "test-token",
  }, { provider: "" });

  assert.equal(result.ok, false);
  assert.equal(result.delivered, false);
  assert.equal(result.reason, "email_provider_not_configured");
  assert.equal(result.message.to, "zero@example.com");
});
