export const VERSION = "admin_incident_alert_policy_v1";

const clean = (value) => String(value ?? "").trim();

export function classifyAdminIncidentAlert(record, source) {
  const failureCodes = Array.isArray(record?.failureCodes)
    ? record.failureCodes.map(clean).filter(Boolean).slice(0, 20)
    : [];
  const transition = clean(record?.transition) || "none";
  const open = record?.open === true;
  const alertKind = clean(record?.alertKind) || null;
  const reportStatus = clean(record?.reportStatus || record?.status) || "unknown";

  let severity = "info";
  if (open || alertKind === "failure" || transition.startsWith("failure_")) severity = "critical";
  else if (alertKind === "recovery" || transition === "recovered") severity = "recovery";

  return Object.freeze({
    source: clean(source) || "unknown",
    severity,
    transition,
    open,
    alertKind,
    reportStatus,
    failureCodes: Object.freeze(failureCodes),
    lastObservedAt: clean(record?.lastObservedAt || record?.generatedAt) || null,
    lastAlertAt: clean(record?.lastAlertAt) || null,
    shouldNotify: severity === "critical" || severity === "recovery",
  });
}

export function buildAdminAlertChannelReadiness(env = process.env) {
  const provider = clean(env.CUSTOMER_EMAIL_PROVIDER).toLowerCase();
  const transportConfigured =
    provider === "resend" &&
    Boolean(clean(env.RESEND_API_KEY)) &&
    Boolean(clean(env.CUSTOMER_EMAIL_FROM)) &&
    Boolean(clean(env.GS_WATCHDOG_ALERT_RECIPIENT));

  const opsAiAuthorized =
    clean(env.GS_WATCHDOG_EMAIL_SEND_AUTHORIZED).toLowerCase() === "true";
  const infrastructureAuthorized =
    clean(env.GS_INFRA_WATCHDOG_EMAIL_SEND_AUTHORIZED).toLowerCase() === "true";

  return Object.freeze({
    email: Object.freeze({
      provider: provider || "unconfigured",
      transportConfigured,
      opsAiAuthorized,
      infrastructureAuthorized,
      fullyAuthorized: transportConfigured && opsAiAuthorized && infrastructureAuthorized,
      recipientConfigured: Boolean(clean(env.GS_WATCHDOG_ALERT_RECIPIENT)),
      senderConfigured: Boolean(clean(env.CUSTOMER_EMAIL_FROM)),
    }),
    companion: Object.freeze({
      apiAvailable: true,
      nativePushConfigured: false,
      androidClientConnected: false,
      windowsClientConnected: false,
    }),
    secretsExposed: false,
  });
}

export function buildAdminIncidentAlertSummary({
  infrastructureIncident = null,
  opsAiIncident = null,
  env = process.env,
} = {}) {
  const incidents = Object.freeze([
    classifyAdminIncidentAlert(infrastructureIncident, "infrastructure"),
    classifyAdminIncidentAlert(opsAiIncident, "ops_ai"),
  ]);
  return Object.freeze({
    version: VERSION,
    incidents,
    criticalOpenCount: incidents.filter((item) => item.severity === "critical" && item.open).length,
    notificationPendingCount: incidents.filter((item) => item.shouldNotify).length,
    channels: buildAdminAlertChannelReadiness(env),
    readOnly: true,
    notificationSendPerformed: false,
  });
}

export default {
  VERSION,
  classifyAdminIncidentAlert,
  buildAdminAlertChannelReadiness,
  buildAdminIncidentAlertSummary,
};
