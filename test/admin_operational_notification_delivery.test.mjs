import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildAdminOperationalEmailMessage,
  createAdminOperationalEmailDelivery,
} from "../src/scanner/admin_operational_notification_delivery.mjs";

test("builds sanitized shared Admin failure and recovery messages", () => {
  const failure = buildAdminOperationalEmailMessage({
    source: "infrastructure",
    severity: "critical",
    transition: "opened",
    reportStatus: "unhealthy",
    failureCodes: ["LOCAL_HEALTH_FAILED"],
    generatedAt: "2026-08-11T02:30:00.000Z",
  });
  assert.match(failure.subject, /FAILURE: Infrastructure/);
  assert.match(failure.text, /LOCAL_HEALTH_FAILED/);
  assert.match(failure.text, /No remediation or trading action was performed/);
  assert.equal(failure.sanitized, true);

  const recovery = buildAdminOperationalEmailMessage({
    source: "ops_ai",
    severity: "recovery",
    transition: "recovered",
    reportStatus: "healthy",
  });
  assert.match(recovery.subject, /RECOVERY: Ops AI/);
});

test("shared delivery uses Resend without exposing configuration values in result", async () => {
  let request = null;
  const delivery = createAdminOperationalEmailDelivery({
    env: {
      CUSTOMER_EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "secret-test-key",
      CUSTOMER_EMAIL_FROM: "sender@example.test",
      GS_WATCHDOG_ALERT_RECIPIENT: "alerts@example.test",
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ id: "delivery-test-id" }) };
    },
  });
  assert.equal(delivery.configured, true);
  const result = await delivery.send({
    source: "ops_ai",
    severity: "critical",
    transition: "failure_opened",
    reportStatus: "unhealthy",
    failureCodes: ["SCANNER_FAILURE"],
    generatedAt: "2026-08-11T02:30:00.000Z",
  });
  assert.equal(result.delivered, true);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.doesNotMatch(JSON.stringify(result), /secret-test-key|alerts@example\.test|sender@example\.test/);
});

test("both watchdog implementations use the shared Admin operational delivery module", () => {
  const ops = fs.readFileSync("src/scanner/ops_ai_scanner_watchdog_runtime.mjs", "utf8");
  const infra = fs.readFileSync("scripts/run_infrastructure_website_watchdog.mjs", "utf8");
  assert.match(ops, /admin_operational_notification_delivery\.mjs/);
  assert.match(ops, /createAdminOperationalEmailDelivery/);
  assert.match(infra, /admin_operational_notification_delivery\.mjs/);
  assert.match(infra, /createAdminOperationalEmailDelivery/);
  assert.doesNotMatch(infra, /https:\/\/api\.resend\.com\/emails/);
});

test("watchdog send authorization remains externally gated", () => {
  const opsRunner = fs.readFileSync("scripts/run_ops_ai_scanner_watchdog.mjs", "utf8");
  const infra = fs.readFileSync("scripts/run_infrastructure_website_watchdog.mjs", "utf8");
  assert.match(opsRunner, /GS_WATCHDOG_EMAIL_SEND_AUTHORIZED/);
  assert.match(opsRunner, /allowEmailSend:sendAuthorized/);
  assert.match(infra, /GS_INFRA_WATCHDOG_EMAIL_SEND_AUTHORIZED/);
  assert.match(infra, /state\.shouldAlert&&allowEmail/);
});

test("shared delivery module contains no broker or order execution behavior", () => {
  const source = fs.readFileSync("src/scanner/admin_operational_notification_delivery.mjs", "utf8");
  assert.doesNotMatch(source, /paper-api\.alpaca|api\.alpaca|submitOrder|cancelOrder|\/v2\/orders/);
});


test("shared daily operational budget blocks provider calls after configured cap", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-admin-budget-"));
  const budgetLedgerPath = path.join(root, "budget.jsonl");
  try {
    fs.writeFileSync(budgetLedgerPath, [
      JSON.stringify({ generatedAt: "2026-08-28T10:00:00.000Z", attempted: true }),
      JSON.stringify({ generatedAt: "2026-08-28T11:00:00.000Z", attempted: true }),
    ].join("\n") + "\n");
    let fetches = 0;
    const delivery = createAdminOperationalEmailDelivery({
      env: {
        CUSTOMER_EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "test-key",
        CUSTOMER_EMAIL_FROM: "sender@example.test",
        GS_WATCHDOG_ALERT_RECIPIENT: "admin@example.test",
        GS_ADMIN_OPERATIONAL_EMAIL_DAILY_CAP: "2",
      },
      budgetLedgerPath,
      now: () => new Date("2026-08-28T12:00:00.000Z"),
      fetchImpl: async () => {
        fetches += 1;
        throw new Error("provider must not be called");
      },
    });
    const result = await delivery.send({
      source: "paper_execution",
      severity: "critical",
      transition: "failure_opened",
      reportStatus: "open",
      failureCodes: ["TEST"],
      generatedAt: "2026-08-28T12:00:00.000Z",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.reason, "admin_operational_daily_cap_reached");
    assert.equal(fetches, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Resend daily quota response is classified for UTC-day backoff", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gs-admin-resend-quota-"));
  const budgetLedgerPath = path.join(root, "budget.jsonl");
  try {
    const delivery = createAdminOperationalEmailDelivery({
      env: {
        CUSTOMER_EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "test-key",
        CUSTOMER_EMAIL_FROM: "sender@example.test",
        GS_WATCHDOG_ALERT_RECIPIENT: "admin@example.test",
        GS_ADMIN_OPERATIONAL_EMAIL_DAILY_CAP: "20",
      },
      budgetLedgerPath,
      now: () => new Date("2026-08-28T12:00:00.000Z"),
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({ name: "daily_quota_exceeded", message: "quota reached" }),
      }),
    });
    const result = await delivery.send({
      source: "paper_execution",
      severity: "critical",
      transition: "failure_opened",
      reportStatus: "open",
      failureCodes: ["TEST"],
      generatedAt: "2026-08-28T12:00:00.000Z",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.statusCode, 429);
    assert.equal(result.reason, "daily_quota_exceeded");
    const rows = fs.readFileSync(budgetLedgerPath, "utf8").trim().split(/\\r?\\n/).map(JSON.parse);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].attempted, true);
    assert.equal(rows[0].delivered, false);
    assert.equal(rows[0].statusCode, 429);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
