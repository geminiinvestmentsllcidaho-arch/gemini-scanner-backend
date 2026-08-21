export const VERSION = "admin_operational_notification_delivery_v1";

const clean = (value, max = 800) => String(value ?? "").trim().slice(0, max);

export function buildAdminOperationalEmailMessage({
  source,
  severity,
  transition,
  reportStatus,
  failureCodes = [],
  generatedAt,
  recipient,
  sender,
} = {}) {
  const safeSource = clean(source, 80) || "unknown";
  const safeSeverity = clean(severity, 40).toLowerCase() || "info";
  const safeTransition = clean(transition, 80) || "none";
  const safeStatus = clean(reportStatus, 80) || "unknown";
  const safeCodes = Array.isArray(failureCodes)
    ? failureCodes.map((value) => clean(value, 120)).filter(Boolean).slice(0, 20)
    : [];
  const kind = safeSeverity === "recovery" ? "RECOVERY" : "FAILURE";
  const sourceLabel =
    safeSource === "ops_ai" ? "Ops AI" :
    safeSource === "infrastructure" ? "Infrastructure" :
    safeSource;

  return Object.freeze({
    recipient: clean(recipient, 320),
    sender: clean(sender, 320),
    subject: `[GeminiScanner Admin] ${kind}: ${sourceLabel}`,
    text: [
      `GeminiScanner Admin ${kind}`,
      "",
      `Source: ${sourceLabel}`,
      `Generated: ${clean(generatedAt, 80) || "unknown"}`,
      `Status: ${safeStatus}`,
      `Transition: ${safeTransition}`,
      `Failure codes: ${safeCodes.join(", ") || "none"}`,
      "",
      "Operational notification only. No remediation or trading action was performed.",
    ].join("\n"),
    sanitized: true,
  });
}

export function createAdminOperationalEmailDelivery({
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  const configured =
    clean(env.CUSTOMER_EMAIL_PROVIDER).toLowerCase() === "resend" &&
    Boolean(clean(env.RESEND_API_KEY)) &&
    Boolean(clean(env.CUSTOMER_EMAIL_FROM)) &&
    Boolean(clean(env.GS_WATCHDOG_ALERT_RECIPIENT));

  const sendMessage = async ({ subject, text } = {}) => {
    const provider = clean(env.CUSTOMER_EMAIL_PROVIDER).toLowerCase();
    const apiKey = clean(env.RESEND_API_KEY);
    const sender = clean(env.CUSTOMER_EMAIL_FROM);
    const recipient = clean(env.GS_WATCHDOG_ALERT_RECIPIENT);
    if (provider !== "resend") return Object.freeze({ delivered: false, reason: "email_provider_not_configured" });
    if (!apiKey || !sender || !recipient || typeof fetchImpl !== "function") return Object.freeze({ delivered: false, reason: "resend_not_configured" });
    const safeSubject = clean(subject, 240);
    const safeText = String(text ?? "").replace(/\r/g, "").slice(0, 8000);
    if (!safeSubject || !safeText) return Object.freeze({ delivered: false, reason: "email_message_invalid" });
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender, to: [recipient], subject: safeSubject, text: safeText }),
    });
    const body = await response.json().catch(() => ({}));
    return Object.freeze({ delivered: response.ok && Boolean(clean(body?.id)), provider: "resend", deliveryId: clean(body?.id) || null, statusCode: response.status });
  };

  return Object.freeze({
    configured,
    sendMessage,
    async send(notification) {
      const provider = clean(env.CUSTOMER_EMAIL_PROVIDER).toLowerCase();
      const apiKey = clean(env.RESEND_API_KEY);
      const sender = clean(env.CUSTOMER_EMAIL_FROM);
      const recipient = clean(env.GS_WATCHDOG_ALERT_RECIPIENT);
      if (provider !== "resend") {
        return Object.freeze({ delivered: false, reason: "email_provider_not_configured" });
      }
      if (!apiKey || !sender || !recipient || typeof fetchImpl !== "function") {
        return Object.freeze({ delivered: false, reason: "resend_not_configured" });
      }
      const message = buildAdminOperationalEmailMessage({
        ...notification,
        sender,
        recipient,
      });
      return sendMessage({ subject: message.subject, text: message.text });
    },
  });
}

export default {
  VERSION,
  buildAdminOperationalEmailMessage,
  createAdminOperationalEmailDelivery,
};
