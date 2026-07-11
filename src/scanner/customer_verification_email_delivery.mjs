export const VERSION = "customer_verification_email_delivery_v1";

function clean(value) {
  return String(value ?? "").trim();
}

export function buildCustomerVerificationEmail(input = {}) {
  const email = clean(input.email).toLowerCase();
  const token = clean(input.token);
  const baseUrl = clean(input.baseUrl) || "https://geminiscanner.net";

  if (!email || !token) {
    throw new Error("verification_email_input_required");
  }

  const verifyUrl = `${baseUrl.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;

  return Object.freeze({
    to: email,
    subject: "Verify your GeminiScanner email",
    text: [
      "Verify your GeminiScanner email address.",
      "",
      verifyUrl,
      "",
      "This link expires in 24 hours.",
    ].join("\n"),
    verifyUrl,
  });
}

export async function deliverCustomerVerificationEmail(input = {}, options = {}) {
  const message = buildCustomerVerificationEmail(input);
  const provider = clean(options.provider || process.env.CUSTOMER_EMAIL_PROVIDER).toLowerCase();

  if (!provider) {
    return Object.freeze({
      ok: false,
      delivered: false,
      reason: "email_provider_not_configured",
      message,
    });
  }

  if (provider === "resend") {
    const apiKey = clean(options.apiKey || process.env.RESEND_API_KEY);
    const from = clean(options.from || process.env.CUSTOMER_EMAIL_FROM);
    const fetchImpl = options.fetchImpl || globalThis.fetch;

    if (!apiKey || !from || typeof fetchImpl !== "function") {
      return Object.freeze({
        ok: false,
        delivered: false,
        reason: "resend_not_configured",
        provider,
        message,
      });
    }

    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !clean(body.id)) {
      return Object.freeze({
        ok: false,
        delivered: false,
        reason: "resend_delivery_failed",
        provider,
        status: response.status,
      });
    }

    return Object.freeze({
      ok: true,
      delivered: true,
      provider,
      deliveryId: clean(body.id),
    });
  }

  return Object.freeze({
    ok: false,
    delivered: false,
    reason: "email_provider_not_supported",
    provider,
    message,
  });
}
