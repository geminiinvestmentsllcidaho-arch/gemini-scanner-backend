import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildAdminAlertChannelReadiness,
  buildAdminIncidentAlertSummary,
  classifyAdminIncidentAlert,
} from "../src/scanner/admin_incident_alert_policy.mjs";

test("classifies watchdog failure and recovery transitions for Admin notification clients", () => {
  const failure = classifyAdminIncidentAlert({
    open: true,
    transition: "failure_opened",
    alertKind: "failure",
    reportStatus: "unhealthy",
    failureCodes: ["HEALTH_DEGRADED"],
  }, "infrastructure");
  assert.equal(failure.severity, "critical");
  assert.equal(failure.shouldNotify, true);
  assert.deepEqual(failure.failureCodes, ["HEALTH_DEGRADED"]);

  const recovery = classifyAdminIncidentAlert({
    open: false,
    transition: "recovered",
    alertKind: "recovery",
    reportStatus: "healthy",
  }, "ops_ai");
  assert.equal(recovery.severity, "recovery");
  assert.equal(recovery.shouldNotify, true);
});

test("reports email channel readiness without exposing configuration values", () => {
  const readiness = buildAdminAlertChannelReadiness({
    CUSTOMER_EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "secret-test-key",
    CUSTOMER_EMAIL_FROM: "sender@example.test",
    GS_WATCHDOG_ALERT_RECIPIENT: "alerts@example.test",
    GS_WATCHDOG_EMAIL_SEND_AUTHORIZED: "true",
    GS_INFRA_WATCHDOG_EMAIL_SEND_AUTHORIZED: "true",
  });
  assert.equal(readiness.email.transportConfigured, true);
  assert.equal(readiness.email.fullyAuthorized, true);
  assert.equal(readiness.secretsExposed, false);
  const serialized = JSON.stringify(readiness);
  assert.doesNotMatch(serialized, /secret-test-key|sender@example\.test|alerts@example\.test/);
});

test("builds unified secret-free incident summary without sending notifications", () => {
  const summary = buildAdminIncidentAlertSummary({
    infrastructureIncident: { open: true, transition: "failure_opened", failureCodes: ["ROOT_UNREACHABLE"] },
    opsAiIncident: { open: false, transition: "none", reportStatus: "healthy" },
    env: {},
  });
  assert.equal(summary.criticalOpenCount, 1);
  assert.equal(summary.notificationSendPerformed, false);
  assert.equal(summary.readOnly, true);
  assert.equal(summary.channels.email.transportConfigured, false);
});

test("protected companion route appends unified alert summary", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const start = server.indexOf("app.get('/admin/api/companion/status'");
  const end = server.indexOf("\n});", start);
  const route = server.slice(start, end + 4);
  assert.match(route, /requireAdminAuthorization/);
  assert.match(route, /admin_incident_alert_policy\.mjs/);
  assert.match(route, /buildAdminIncidentAlertSummary/);
  assert.match(route, /json\(\{ \.\.\.payload, alerts \}\)/);
  assert.doesNotMatch(route, /api\.resend\.com|submitOrder|cancelOrder/);
});
