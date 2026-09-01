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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildCustomerReportEmail(input = {}) {
  const email = clean(input.email).toLowerCase();
  const period = clean(input.period).toLowerCase();
  const generatedAt = clean(input.generatedAt);
  const summary = clean(input.summary);
  const reportUrl = clean(input.reportUrl);

  if (!email || !period) {
    throw new Error("customer_report_email_input_required");
  }

  const label = periodLabel(period);
  const lines = [
    `${label} GeminiScanner report`,
    "",
    "PDF REPORT ATTACHED",
    "Your complete report is attached as a PDF.",
    ...(reportUrl ? [`Open report: ${reportUrl}`] : []),
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

  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">',
    `<h2 style="margin:0 0 12px">${escapeHtml(label)} GeminiScanner report</h2>`,
    '<div style="margin:0 0 18px;padding:14px 16px;border:1px solid #d7dde3;border-radius:12px;background:#f7f9fb">',
    '<strong>PDF REPORT ATTACHED</strong><br>',
    '<span>Your complete report is attached as a PDF.</span>',
    reportUrl
      ? `<div style="margin-top:12px"><a href="${escapeHtml(reportUrl)}" style="display:inline-block;padding:11px 16px;border-radius:9px;background:#111;color:#fff;text-decoration:none;font-weight:700">OPEN REPORT</a></div>`
      : "",
    '</div>',
    `<p>${escapeHtml(summary || "Your read-only GeminiScanner customer report is ready.")}</p>`,
    generatedAt ? `<p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>` : "",
    '<p style="color:#5f6b76">Decision-assist and paper analytics only. No order placement, broker contact, or account mutation.</p>',
    '</div>',
  ].join("");

  return Object.freeze({
    to: email,
    subject: `${label} GeminiScanner report`,
    text: lines.join("\n"),
    html,
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
        html: message.html,
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
