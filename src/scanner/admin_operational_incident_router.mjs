import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION = "admin_operational_incident_router_v1";
export const DEFAULT_LEDGER_PATH = path.resolve("runs/admin_operational_incidents.jsonl");

const clean = (value, max = 240) => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const safeCode = (value) => clean(value, 120).replace(/[^A-Za-z0-9_.:-]/g, "_") || "UNKNOWN";

const CATEGORY_BY_SOURCE = Object.freeze({
  application: "application_runtime",
  runtime: "application_runtime",
  pm2: "application_runtime",
  paper_execution: "paper_execution",
  broker: "paper_execution",
  paper_reconciliation: "paper_reconciliation",
  security: "security",
  infrastructure: "infrastructure",
  storage: "storage",
  backup: "storage",
  queue: "queue",
});

export function normalizeAdminOperationalIncident(input = {}, options = {}) {
  const now = new Date(options.now ?? input.generatedAt ?? Date.now());
  const source = clean(input.source, 80).toLowerCase() || "application";
  const category = clean(input.category, 80).toLowerCase() || CATEGORY_BY_SOURCE[source] || "application_runtime";
  const failureCodes = Array.isArray(input.failureCodes)
    ? input.failureCodes.map(safeCode).filter(Boolean).slice(0, 20)
    : [safeCode(input.failureCode || input.errorCode || input.error || "UNKNOWN")];
  const requestedSeverity = clean(input.severity, 20).toLowerCase();
  const severity = ["critical", "high", "medium", "low", "recovery"].includes(requestedSeverity)
    ? requestedSeverity
    : "critical";
  const open = severity !== "recovery";
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify([category, source, [...failureCodes].sort()]))
    .digest("hex")
    .slice(0, 24);

  return Object.freeze({
    version: VERSION,
    generatedAt: now.toISOString(),
    source,
    category,
    severity,
    status: open ? "open" : "recovered",
    open,
    failureCodes: Object.freeze(failureCodes),
    fingerprint,
    summary: clean(input.summary || input.message || failureCodes.join(", "), 500),
    metadata: Object.freeze({
      phase: clean(input.phase, 40) || null,
      route: clean(input.route, 160) || null,
      process: clean(input.process, 120) || null,
    }),
    containsSecrets: false,
    remediationAllowed: false,
    brokerContactPerformed: false,
    orderActionPerformed: false,
    accountMutationPerformed: false,
    liveTradingActionPerformed: false,
  });
}

export function buildAdminOperationalIncidentTransition(incident, previous = null, options = {}) {
  const now = new Date(options.now ?? incident?.generatedAt ?? Date.now());
  const cooldownMs = Math.max(0, Number(options.cooldownMs ?? 3600000));
  const same = previous?.fingerprint === incident?.fingerprint;
  const wasOpen = previous?.open === true;
  const isOpen = incident?.open === true;
  const lastAlertAt = Date.parse(previous?.lastAlertAt ?? "");
  const cooldownElapsed = !Number.isFinite(lastAlertAt) || now.getTime() - lastAlertAt >= cooldownMs;

  let transition = "none";
  let shouldNotify = false;
  if (isOpen && !wasOpen) {
    transition = "failure_opened";
    shouldNotify = true;
  } else if (!isOpen && wasOpen) {
    transition = "recovered";
    shouldNotify = true;
  } else if (isOpen && wasOpen && !same) {
    transition = "failure_changed";
    shouldNotify = true;
  } else if (isOpen && wasOpen && same && cooldownElapsed) {
    transition = "failure_reminder";
    shouldNotify = true;
  }

  return Object.freeze({
    ...incident,
    transition,
    shouldNotify,
    deduplicated: isOpen && wasOpen && same && !shouldNotify,
    lastAlertAt: shouldNotify ? now.toISOString() : previous?.lastAlertAt ?? null,
    cooldownMs,
  });
}

export function readLatestAdminOperationalIncident(options = {}) {
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_LEDGER_PATH);
  try {
    if (!fs.existsSync(ledgerPath)) return null;
    const lines = fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.length ? JSON.parse(lines.at(-1)) : null;
  } catch {
    return null;
  }
}

export function appendAdminOperationalIncident(record, options = {}) {
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_LEDGER_PATH);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  try { fs.chmodSync(ledgerPath, 0o600); } catch {}
  return Object.freeze({ appended: true, ledgerPath, localJsonlOnly: true, containsSecrets: false });
}

export async function routeAdminOperationalIncident(input = {}, options = {}) {
  const incident = normalizeAdminOperationalIncident(input, options);
  const previous = options.previousIncident ?? readLatestAdminOperationalIncident(options);
  const transition = buildAdminOperationalIncidentTransition(incident, previous, options);
  const persistence = appendAdminOperationalIncident(transition, options);

  let delivery = Object.freeze({
    attempted: false,
    delivered: false,
    reason: "transition_not_alertable",
  });

  if (transition.shouldNotify && options.allowNotificationSend === true && options.delivery?.send) {
    const result = await options.delivery.send({
      source: transition.category,
      severity: transition.severity === "recovery" ? "recovery" : "critical",
      transition: transition.transition,
      reportStatus: transition.status,
      failureCodes: transition.failureCodes,
      generatedAt: transition.generatedAt,
    });
    delivery = Object.freeze({ attempted: true, ...result });
  } else if (transition.shouldNotify) {
    delivery = Object.freeze({
      attempted: false,
      delivered: false,
      reason: "notification_send_not_authorized",
    });
  }

  return Object.freeze({
    version: VERSION,
    incident: transition,
    persistence,
    delivery,
    notificationSendAuthorized: options.allowNotificationSend === true,
    remediationAllowed: false,
    brokerContactPerformed: false,
    orderActionPerformed: false,
    accountMutationPerformed: false,
    liveTradingActionPerformed: false,
  });
}

export default Object.freeze({
  VERSION,
  DEFAULT_LEDGER_PATH,
  normalizeAdminOperationalIncident,
  buildAdminOperationalIncidentTransition,
  readLatestAdminOperationalIncident,
  appendAdminOperationalIncident,
  routeAdminOperationalIncident,
});
