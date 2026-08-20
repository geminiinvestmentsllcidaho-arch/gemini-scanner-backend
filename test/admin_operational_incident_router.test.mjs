import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  normalizeAdminOperationalIncident,
  buildAdminOperationalIncidentTransition,
  routeAdminOperationalIncident,
} from "../src/scanner/admin_operational_incident_router.mjs";

test("normalizes PAPER and PM2 incidents without operational actions", () => {
  const paper = normalizeAdminOperationalIncident({
    source: "paper_reconciliation",
    failureCode: "paper_exit_matching_lifecycle_not_found",
    phase: "EXIT",
  }, { now: "2026-08-11T03:00:00.000Z" });
  assert.equal(paper.category, "paper_reconciliation");
  assert.equal(paper.failureCodes[0], "paper_exit_matching_lifecycle_not_found");
  assert.equal(paper.containsSecrets, false);
  assert.equal(paper.brokerContactPerformed, false);
  assert.equal(paper.orderActionPerformed, false);
  assert.equal(paper.accountMutationPerformed, false);
  assert.equal(paper.liveTradingActionPerformed, false);

  const runtime = normalizeAdminOperationalIncident({
    source: "pm2",
    errorCode: "SERVER_RUNTIME_EXCEPTION",
    process: "gemini-scanner",
  });
  assert.equal(runtime.category, "application_runtime");
});

test("deduplicates repeated open incidents before cooldown", () => {
  const incident = normalizeAdminOperationalIncident({
    source: "paper_execution",
    failureCode: "paper_exit_only_broker_position_identity_mismatch",
  }, { now: "2026-08-11T03:00:00.000Z" });
  const opened = buildAdminOperationalIncidentTransition(incident, null, {
    now: "2026-08-11T03:00:00.000Z",
    cooldownMs: 3600000,
  });
  assert.equal(opened.transition, "failure_opened");
  assert.equal(opened.shouldNotify, true);
  const repeat = buildAdminOperationalIncidentTransition(
    { ...incident, generatedAt: "2026-08-11T03:10:00.000Z" },
    { ...opened, open: true, lastAlertAt: "2026-08-11T03:00:00.000Z", delivery: { attempted: true, delivered: true } },
    { now: "2026-08-11T03:10:00.000Z", cooldownMs: 3600000 },
  );
  assert.equal(repeat.shouldNotify, false);
  assert.equal(repeat.deduplicated, true);
});

test("persists 0600 ledger and blocks delivery unless separately authorized", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-admin-incident-"));
  const ledgerPath = path.join(root, "incidents.jsonl");
  let sends = 0;
  const result = await routeAdminOperationalIncident({
    source: "security",
    failureCode: "AUTHENTICATOR_ACCOUNT_MISMATCH",
  }, {
    ledgerPath,
    now: "2026-08-11T03:00:00.000Z",
    allowNotificationSend: false,
    delivery: { send: async () => { sends += 1; return { delivered: true }; } },
  });
  assert.equal(result.persistence.appended, true);
  assert.equal(result.delivery.attempted, false);
  assert.equal(sends, 0);
  assert.equal(fs.statSync(ledgerPath).mode & 0o777, 0o600);
});

test("router source contains no broker or order execution implementation", () => {
  const source = fs.readFileSync("src/scanner/admin_operational_incident_router.mjs", "utf8");
  assert.doesNotMatch(source, /paper-api\.alpaca|api\.alpaca|\/v2\/orders|submitOrder|cancelOrder/);
});


test("failed authorized delivery is persisted and retried on bounded retry cooldown", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-admin-retry-"));
  const ledgerPath = path.join(root, "incidents.jsonl");
  try {
    let sends = 0;
    const delivery = { send: async () => {
      sends += 1;
      return { delivered: sends > 1, provider: "test", statusCode: sends > 1 ? 200 : 503 };
    } };
    const first = await routeAdminOperationalIncident({
      source: "paper_execution",
      failureCode: "ENTER_STALLED",
    }, {
      ledgerPath,
      now: "2026-08-11T03:00:00.000Z",
      retryCooldownMs: 300000,
      allowNotificationSend: true,
      delivery,
    });
    assert.equal(first.delivery.attempted, true);
    assert.equal(first.delivery.delivered, false);
    assert.equal(first.incident.lastAlertAt, null);
    assert.equal(first.incident.lastNotificationAttemptAt, "2026-08-11T03:00:00.000Z");

    const early = await routeAdminOperationalIncident({
      source: "paper_execution",
      failureCode: "ENTER_STALLED",
    }, {
      ledgerPath,
      now: "2026-08-11T03:04:59.000Z",
      retryCooldownMs: 300000,
      allowNotificationSend: true,
      delivery,
    });
    assert.equal(early.incident.shouldNotify, false);
    assert.equal(sends, 1);

    const retry = await routeAdminOperationalIncident({
      source: "paper_execution",
      failureCode: "ENTER_STALLED",
    }, {
      ledgerPath,
      now: "2026-08-11T03:05:00.000Z",
      retryCooldownMs: 300000,
      allowNotificationSend: true,
      delivery,
    });
    assert.equal(retry.incident.transition, "failure_delivery_retry");
    assert.equal(retry.delivery.delivered, true);
    assert.equal(retry.incident.lastAlertAt, "2026-08-11T03:05:00.000Z");
    assert.equal(sends, 2);
    const persisted = JSON.parse(fs.readFileSync(ledgerPath, "utf8").trim().split(/\r?\n/).at(-1));
    assert.equal(persisted.delivery.delivered, true);
    assert.equal(persisted.delivery.provider, "test");
    assert.equal("deliveryId" in persisted.delivery, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("delivery exception is persisted as sanitized failure instead of escaping", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-admin-retry-"));
  const ledgerPath = path.join(root, "incidents.jsonl");
  try {
    const result = await routeAdminOperationalIncident({
      source: "paper_execution",
      failureCode: "ROUTER_TEST",
    }, {
      ledgerPath,
      now: "2026-08-11T04:00:00.000Z",
      allowNotificationSend: true,
      delivery: { send: async () => { throw Object.assign(new Error("secret detail"), { code: "ETIMEDOUT" }); } },
    });
    assert.equal(result.delivery.attempted, true);
    assert.equal(result.delivery.delivered, false);
    assert.equal(result.delivery.reason, "notification_delivery_exception");
    assert.equal(result.delivery.errorCode, "ETIMEDOUT");
    const raw = fs.readFileSync(ledgerPath, "utf8");
    assert.doesNotMatch(raw, /secret detail/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("failed recovery notification is eligible for bounded recovery retry", () => {
  const incident = normalizeAdminOperationalIncident({
    source: "paper_execution",
    severity: "recovery",
    failureCode: "RECOVERED",
  }, { now: "2026-08-11T05:05:00.000Z" });
  const previous = {
    ...incident,
    generatedAt: "2026-08-11T05:00:00.000Z",
    status: "recovered",
    open: false,
    lastNotificationAttemptAt: "2026-08-11T05:00:00.000Z",
    lastAlertAt: null,
    delivery: { attempted: true, delivered: false, reason: "resend_failed" },
  };
  const retry = buildAdminOperationalIncidentTransition(incident, previous, {
    now: "2026-08-11T05:05:00.000Z",
    retryCooldownMs: 300000,
  });
  assert.equal(retry.transition, "recovery_delivery_retry");
  assert.equal(retry.shouldNotify, true);
});
