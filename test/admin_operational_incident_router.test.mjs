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
    { ...opened, open: true, lastAlertAt: "2026-08-11T03:00:00.000Z" },
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
