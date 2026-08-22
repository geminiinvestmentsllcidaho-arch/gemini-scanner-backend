import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createAdminOperationalEmailDelivery } from "./admin_operational_notification_delivery.mjs";
import {
  createCadenceVerifierState,
  observeUnderFiveCadence,
} from "./alpaca_under_five_cadence_verifier.mjs";

export const VERSION = "alpaca_under_five_cadence_verifier_runtime_v1";
export const DEFAULT_STATE_PATH = path.resolve("runs/alpaca_under_five_cadence_verifier_state.json");
export const DEFAULT_LEDGER_PATH = path.resolve("runs/alpaca_under_five_cadence_verifier_results.jsonl");

const execFileAsync = promisify(execFile);
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const safeJson = (text) => { try { return JSON.parse(String(text ?? "")); } catch { return null; } };

function ensurePrivateFile(filePath) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(resolved)) fs.closeSync(fs.openSync(resolved, "a", 0o600));
  try { fs.chmodSync(resolved, 0o600); } catch {}
  return resolved;
}

export function createCadenceVerifierHttpAdapter({
  fetchImpl = globalThis.fetch,
  baseUrl = "http://127.0.0.1:3000",
  timeoutMs = 10000,
} = {}) {
  return Object.freeze({
    async getJson(route) {
      if (typeof fetchImpl !== "function") throw new Error("CADENCE_FETCH_UNAVAILABLE");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer?.unref?.();
      try {
        const response = await fetchImpl(`${baseUrl}${route}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        return Object.freeze({ ok: response.ok, statusCode: response.status, body });
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export function createCadenceVerifierPm2Adapter({ execFileImpl = execFileAsync } = {}) {
  return Object.freeze({
    async list() {
      const { stdout } = await execFileImpl("pm2", ["jlist"], {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 10000,
      });
      const rows = safeJson(stdout);
      if (!Array.isArray(rows)) throw new Error("PM2_JLIST_INVALID");
      return Object.freeze(rows.map((row) => Object.freeze({
        name: clean(row?.name, 120),
        status: clean(row?.pm2_env?.status, 64) || "unknown",
      })));
    },
  });
}

export function readCadenceVerifierState({ statePath = DEFAULT_STATE_PATH } = {}) {
  const resolved = ensurePrivateFile(statePath);
  try {
    const parsed = safeJson(fs.readFileSync(resolved, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : createCadenceVerifierState();
  } catch {
    return createCadenceVerifierState();
  }
}

export function writeCadenceVerifierState(state, { statePath = DEFAULT_STATE_PATH } = {}) {
  const resolved = ensurePrivateFile(statePath);
  fs.writeFileSync(resolved, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch {}
  return Object.freeze({ path: resolved, written: true, mode: 0o600 });
}

export function appendCadenceVerifierResult(record, { ledgerPath = DEFAULT_LEDGER_PATH } = {}) {
  const resolved = ensurePrivateFile(ledgerPath);
  fs.appendFileSync(resolved, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch {}
  return Object.freeze({ path: resolved, appended: true, mode: 0o600 });
}

export async function collectCadenceVerifierInput({ http, pm2 } = {}) {
  const [healthResult, diagnosticsResult, pm2Rows] = await Promise.all([
    http.getJson("/health"),
    http.getJson("/diagnostics/alpaca-under-five-shared-cache"),
    pm2.list(),
  ]);
  return Object.freeze({
    health: healthResult?.body ?? {},
    diagnostics: diagnosticsResult?.body?.diagnostics ?? {},
    pm2: pm2Rows,
  });
}

export function buildCadenceVerifierEmail(result = {}) {
  const status = String(result?.status ?? "unknown").toUpperCase();
  const violations = Array.isArray(result?.violations) ? result.violations : [];
  return Object.freeze({
    subject: `[GeminiScanner Cadence] ${status}`,
    text: [
      `GeminiScanner under-five cadence verifier ${status}`,
      "",
      `Generated: ${result?.generatedAt ?? "unknown"}`,
      `Status: ${result?.status ?? "unknown"}`,
      `Market open: ${result?.marketOpen === true}`,
      `Broad events observed: ${Number(result?.evidence?.broadObserved ?? 0)}`,
      `Focused events observed: ${Number(result?.evidence?.focusedObserved ?? 0)}`,
      `Broad candidate count: ${Number(result?.evidence?.broadCandidateCount ?? 0)}`,
      `Violations: ${violations.length ? violations.join(", ") : "none"}`,
      "",
      "Read-only cadence verification only. No remediation, broker contact, order placement, account mutation, threshold mutation, scanner-logic mutation, sizing change, lifecycle change, or live-trading action was performed.",
    ].join("\n"),
  });
}

function notificationKey(result = {}) {
  if (!result?.terminal) return null;
  return [
    result.status,
    result?.state?.startedAt ?? "unknown-session",
  ].join("|");
}

export async function runUnderFiveCadenceVerifierOnce(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const http = options.http ?? createCadenceVerifierHttpAdapter(options.httpOptions);
  const pm2 = options.pm2 ?? createCadenceVerifierPm2Adapter(options.pm2Options);
  const delivery = options.delivery ?? createAdminOperationalEmailDelivery(options.emailOptions);

  const statePath = options.statePath ?? DEFAULT_STATE_PATH;
  const ledgerPath = options.ledgerPath ?? DEFAULT_LEDGER_PATH;
  const previousState = options.previousState ?? readCadenceVerifierState({ statePath });
  const input = options.input ?? await collectCadenceVerifierInput({ http, pm2 });

  const result = observeUnderFiveCadence(previousState, input, {
    now,
    minimumObservationSec: options.minimumObservationSec,
    minimumFocusedEvents: options.minimumFocusedEvents,
    focusedStallSec: options.focusedStallSec,
    broadToleranceSec: options.broadToleranceSec,
  });

  const priorTerminalResultKey = clean(previousState?.lastTerminalResultKey, 1000);
  const priorNotificationKey = clean(previousState?.lastNotificationKey, 1000);
  const priorNotificationAttemptKey = clean(previousState?.lastNotificationAttemptKey, 1000);
  const priorNotificationAttemptAt = clean(previousState?.lastNotificationAttemptAt, 80);
  const priorNotificationAttemptCount = Number.isFinite(Number(previousState?.notificationAttemptCount))
    ? Math.max(0, Math.trunc(Number(previousState.notificationAttemptCount)))
    : 0;
  const retryCooldownMs = Math.max(0, Number(options.notificationRetryCooldownMs ?? 60000));
  const maxNotificationAttempts = Math.max(1, Math.trunc(Number(options.maxNotificationAttempts ?? 3)));

  let lastTerminalResultKey = priorTerminalResultKey || null;
  let lastNotificationKey = priorNotificationKey || null;
  let lastNotificationAttemptKey = priorNotificationAttemptKey || null;
  let lastNotificationAttemptAt = priorNotificationAttemptAt || null;
  let notificationAttemptCount = priorNotificationAttemptCount;
  let ledger = Object.freeze({ appended: false, reason: "non_terminal" });
  let alert = Object.freeze({ attempted: false, delivered: false, reason: "non_terminal" });

  if (result.terminal) {
    const key = notificationKey(result);

    if (key && key !== priorTerminalResultKey) {
      ledger = appendCadenceVerifierResult(Object.freeze({
        version: VERSION,
        generatedAt: result.generatedAt,
        status: result.status,
        pass: result.pass,
        violations: result.violations,
        evidence: result.evidence,
        notificationKey: key,
        readOnly: true,
      }), { ledgerPath });
      lastTerminalResultKey = key;
    } else {
      ledger = Object.freeze({ appended: false, reason: "terminal_result_already_recorded" });
    }

    if (key && key === priorNotificationKey) {
      alert = Object.freeze({ attempted: false, delivered: false, reason: "terminal_result_already_notified" });
    } else if (key) {
      const sameAttemptKey = priorNotificationAttemptKey === key;
      const attemptCount = sameAttemptKey ? priorNotificationAttemptCount : 0;
      const lastAttemptMs = sameAttemptKey ? Date.parse(priorNotificationAttemptAt) : NaN;
      const retryElapsed = !Number.isFinite(lastAttemptMs) || now.getTime() - lastAttemptMs >= retryCooldownMs;

      if (attemptCount >= maxNotificationAttempts) {
        alert = Object.freeze({ attempted: false, delivered: false, reason: "email_retry_exhausted" });
      } else if (!retryElapsed) {
        alert = Object.freeze({ attempted: false, delivered: false, reason: "email_retry_cooldown" });
      } else if (options.allowEmailSend === true) {
        const message = buildCadenceVerifierEmail(result);
        let deliveryResult;
        try {
          deliveryResult = await delivery.sendMessage(message);
        } catch (error) {
          deliveryResult = Object.freeze({
            delivered: false,
            reason: "notification_delivery_exception",
            errorCode: clean(error?.code || error?.name || "DELIVERY_EXCEPTION", 80),
          });
        }
        alert = Object.freeze({ attempted: true, ...deliveryResult, delivered: deliveryResult?.delivered === true });
        lastNotificationAttemptKey = key;
        lastNotificationAttemptAt = now.toISOString();
        notificationAttemptCount = attemptCount + 1;
        if (alert.delivered === true) lastNotificationKey = key;
      } else {
        alert = Object.freeze({ attempted: false, delivered: false, reason: "email_send_not_authorized" });
      }
    }
  }

  const persistedState = Object.freeze({
    ...result.state,
    ...(lastTerminalResultKey ? { lastTerminalResultKey } : {}),
    ...(lastNotificationKey ? { lastNotificationKey } : {}),
    ...(lastNotificationAttemptKey ? { lastNotificationAttemptKey } : {}),
    ...(lastNotificationAttemptAt ? { lastNotificationAttemptAt } : {}),
    ...(notificationAttemptCount > 0 ? { notificationAttemptCount } : {}),
  });
  const persistence = writeCadenceVerifierState(persistedState, { statePath });

  return Object.freeze({
    version: VERSION,
    result,
    persistence,
    ledger,
    alert,
    readOnly: true,
    remediationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    liveTradingAllowed: false,
    emailSendAuthorized: options.allowEmailSend === true,
  });
}

export default Object.freeze({
  VERSION,
  DEFAULT_STATE_PATH,
  DEFAULT_LEDGER_PATH,
  createCadenceVerifierHttpAdapter,
  createCadenceVerifierPm2Adapter,
  readCadenceVerifierState,
  writeCadenceVerifierState,
  appendCadenceVerifierResult,
  collectCadenceVerifierInput,
  buildCadenceVerifierEmail,
  runUnderFiveCadenceVerifierOnce,
});
