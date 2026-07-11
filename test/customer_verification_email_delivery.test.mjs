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

test("delivers verification email through configured Resend adapter", async () => {
  const calls = [];
  const result = await deliverCustomerVerificationEmail({
    email: "zero@example.com",
    token: "test-token",
  }, {
    provider: "resend",
    apiKey: "re_test_key",
    from: "GeminiScanner <verify@geminiscanner.net>",
    fetchImpl: async (url, request) => {
      calls.push({ url, request });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "email-123" }),
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.delivered, true);
  assert.equal(result.provider, "resend");
  assert.equal(result.deliveryId, "email-123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].request.headers.Authorization, "Bearer re_test_key");

  const body = JSON.parse(calls[0].request.body);
  assert.equal(body.from, "GeminiScanner <verify@geminiscanner.net>");
  assert.deepEqual(body.to, ["zero@example.com"]);
  assert.match(body.text, /verify-email\?token=test-token/);
});

test("fails closed when Resend credentials are incomplete", async () => {
  const result = await deliverCustomerVerificationEmail({
    email: "zero@example.com",
    token: "test-token",
  }, {
    provider: "resend",
    apiKey: "",
    from: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.delivered, false);
  assert.equal(result.reason, "resend_not_configured");
});
