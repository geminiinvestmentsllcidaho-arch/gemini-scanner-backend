import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerPasswordResetEmail,
  deliverCustomerPasswordResetEmail,
} from "../src/scanner/customer_password_reset_email_delivery.mjs";

test("builds customer password reset email with encoded short-lived link", () => {
  const message = buildCustomerPasswordResetEmail({
    email: "User@Example.com",
    token: "reset token/+",
    baseUrl: "https://geminiscanner.net/",
  });

  assert.equal(message.to, "user@example.com");
  assert.equal(message.subject, "Reset your GeminiScanner password");
  assert.equal(
    message.resetUrl,
    "https://geminiscanner.net/reset-password?token=reset%20token%2F%2B",
  );
  assert.match(message.text, /expires in 30 minutes/i);
});

test("fails closed when password reset email provider is not configured", async () => {
  const result = await deliverCustomerPasswordResetEmail({
    email: "user@example.com",
    token: "token",
  }, { provider: "" });

  assert.equal(result.ok, false);
  assert.equal(result.delivered, false);
  assert.equal(result.reason, "email_provider_not_configured");
});

test("delivers customer password reset email through configured Resend adapter", async () => {
  const calls = [];
  const result = await deliverCustomerPasswordResetEmail(
    { email: "user@example.com", token: "token" },
    {
      provider: "resend",
      apiKey: "test-key",
      from: "GeminiScanner <security@example.com>",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "delivery-123" }),
        };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.delivered, true);
  assert.equal(result.deliveryId, "delivery-123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.doesNotMatch(calls[0].options.body, /test-key/);
});
