import { buildCustomerReportPdf } from "./customer_report_pdf.mjs";

export const VERSION = "customer_report_email_delivery_v2";

function clean(value) {
  return String(value ?? "").trim();
}

function periodLabel(period) {
  return ({
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    ytd: "Year-to-Date",
    lifetime: "Lifetime",
  })[clean(period).toLowerCase()] || "Customer";
}

export function buildCustomerReportEmail(input = {}) {
  const email = clean(input.email).toLowerCase();
  const period = clean(input.period).toLowerCase();
  const generatedAt = clean(input.generatedAt);
  const summary = clean(input.summary);

  if (!email || !period) {
    throw new Error("customer_report_email_input_required");
  }

  const label = periodLabel(period);
  const lines = [
    `${label} GeminiScanner report`,
    "",
    "PDF REPORT ATTACHED",
    "Your complete report is attached as a PDF.",
    "",
    summary || "Your read-only GeminiScanner customer report is ready.",
  ];

  if (generatedAt) {
    lines.push("", `Generated: ${generatedAt}`);
  }

  lines.push(
    "",
    "Decision-assist and paper analytics only. No order placement, broker contact, or account mutation.",
  );

  return Object.freeze({
    to: email,
    subject: `${label} GeminiScanner report`,
    text: lines.join("\n"),
    period,
  });
}

export async function deliverCustomerReportEmail(input = {}, options = {}) {
  const message = buildCustomerReportEmail(input);
  const pdf = input.report ? buildCustomerReportPdf({ period: input.period, report: input.report, generatedAt: input.generatedAt }) : null;
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
        ...(pdf ? { attachments: [{ filename: pdf.filename, content: pdf.buffer.toString("base64"), content_type: pdf.contentType }] } : {}),
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
