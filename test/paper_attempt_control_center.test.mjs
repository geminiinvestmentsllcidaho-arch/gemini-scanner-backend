import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptControlCenter, redactValue, detectMarketHours } from "../src/scanner/paper_attempt_control_center.mjs";

test("paper attempt control center is monitor-only and never attempts network/order path", () => {
  const report = buildPaperAttemptControlCenter({ now: new Date("2026-06-27T20:00:00.000Z") });

  assert.equal(report.ok, true);
  assert.equal(report.version, "paper_attempt_control_center_v1");
  assert.equal(report.monitorOnly, true);
  assert.equal(report.networkAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.rules.noBrokerContact, true);
  assert.equal(report.rules.noNetworkAttempt, true);
  assert.equal(report.rules.noOrderAttempt, true);
  assert.equal(report.rules.noSecretExposure, true);
});

test("paper attempt control center redacts env values", () => {
  assert.deepEqual(redactValue("secret-value"), { present: true, redacted: "[REDACTED]" });
  assert.deepEqual(redactValue(""), { present: false, redacted: null });

  const report = buildPaperAttemptControlCenter({ now: new Date("2026-06-27T20:00:00.000Z") });
  for (const item of Object.values(report.runtimeEnvPresence)) {
    assert.ok(Object.hasOwn(item, "present"));
    assert.ok(Object.hasOwn(item, "redacted"));
    assert.notEqual(item.redacted, "secret-value");
  }
});

test("market hours detector blocks regular weekday trading window only by time check", () => {
  const open = detectMarketHours(new Date("2026-06-26T15:00:00.000Z"));
  const closed = detectMarketHours(new Date("2026-06-27T20:00:00.000Z"));

  assert.equal(open.regularMarketHoursLikelyOpen, true);
  assert.equal(closed.regularMarketHoursLikelyOpen, false);
});

test("unsafe env flags appear as blockers", () => {
  const old = process.env.ORDER_PLACEMENT_ALLOWED;
  process.env.ORDER_PLACEMENT_ALLOWED = "true";
  const report = buildPaperAttemptControlCenter({ now: new Date("2026-06-27T20:00:00.000Z") });
  if (old === undefined) delete process.env.ORDER_PLACEMENT_ALLOWED;
  else process.env.ORDER_PLACEMENT_ALLOWED = old;

  assert.ok(report.blockers.includes("order_placement_allowed_env_true"));
  assert.equal(report.controlCenterStatus, "blocked_monitor_only");
});
