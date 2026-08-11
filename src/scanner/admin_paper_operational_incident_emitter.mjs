import { routeAdminOperationalIncident } from "./admin_operational_incident_router.mjs";
import { createAdminOperationalEmailDelivery } from "./admin_operational_notification_delivery.mjs";
export const VERSION = "admin_paper_operational_incident_emitter_v1";
const clean = (value, max = 240) => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const authorized = (env = process.env) => clean(env.GS_ADMIN_PAPER_ALERT_EMAIL_SEND_AUTHORIZED).toLowerCase() === "true";
export async function emitAdminPaperOperationalIncident(input = {}, options = {}) {
  const env = options.env ?? process.env;
  const delivery = options.delivery ?? createAdminOperationalEmailDelivery({ env, fetchImpl: options.fetchImpl ?? globalThis.fetch });
  return routeAdminOperationalIncident({
    source: clean(input.source, 80) || "paper_execution",
    category: clean(input.category, 80) || undefined,
    severity: clean(input.severity, 20) || "critical",
    failureCode: clean(input.failureCode, 120) || "paper_operational_failure",
    failureCodes: Array.isArray(input.failureCodes) ? input.failureCodes : undefined,
    summary: clean(input.summary, 500) || "PAPER operational incident",
    phase: clean(input.phase, 40) || null,
    route: clean(input.route, 160) || null,
    process: clean(input.process, 120) || null,
  }, {
    ledgerPath: options.ledgerPath,
    allowNotificationSend: options.allowNotificationSend === true || authorized(env),
    delivery,
    now: options.now,
  });
}
export default Object.freeze({ VERSION, emitAdminPaperOperationalIncident });
