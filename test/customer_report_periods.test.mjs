import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerReportPeriodRange,
  customerReportTimestampInRange,
  normalizeCustomerReportPeriod,
} from "../src/scanner/customer_report_periods.mjs";

const NOW = new Date("2026-07-14T22:30:00.000Z");

test("defaults invalid periods to lifetime", () => {
  assert.equal(normalizeCustomerReportPeriod(undefined), "lifetime");
  assert.equal(normalizeCustomerReportPeriod("invalid"), "lifetime");
  assert.equal(normalizeCustomerReportPeriod("weekly"), "weekly");
});

test("builds daily boundary in saved customer timezone", () => {
  const range = buildCustomerReportPeriodRange({
    period: "daily",
    now: NOW,
    timeZone: "America/Denver",
  });

  assert.equal(range.startIso, "2026-07-14T06:00:00.000Z");
  assert.equal(range.endIso, NOW.toISOString());
});

test("builds Monday-start weekly boundary in saved customer timezone", () => {
  const range = buildCustomerReportPeriodRange({
    period: "weekly",
    now: NOW,
    timeZone: "America/Denver",
    weekStartsOn: 1,
  });

  assert.equal(range.weekStartsOn, 1);
  assert.equal(range.startIso, "2026-07-13T06:00:00.000Z");
});

test("builds monthly boundary in saved customer timezone", () => {
  const range = buildCustomerReportPeriodRange({
    period: "monthly",
    now: NOW,
    timeZone: "America/Denver",
  });

  assert.equal(range.startIso, "2026-07-01T06:00:00.000Z");
});

test("builds yearly and year-to-date boundaries", () => {
  for (const period of ["yearly", "ytd"]) {
    const range = buildCustomerReportPeriodRange({
      period,
      now: NOW,
      timeZone: "America/Denver",
    });
    assert.equal(range.startIso, "2026-01-01T07:00:00.000Z");
  }

  const selected = buildCustomerReportPeriodRange({
    period: "yearly",
    year: 2025,
    now: NOW,
    timeZone: "America/Denver",
  });
  assert.equal(selected.startIso, "2025-01-01T07:00:00.000Z");
});

test("lifetime has no lower boundary and excludes future records", () => {
  const range = buildCustomerReportPeriodRange({
    period: "lifetime",
    now: NOW,
    timeZone: "America/Denver",
  });

  assert.equal(range.start, null);
  assert.equal(range.startIso, null);
  assert.equal(range.lifetime, true);
  assert.equal(customerReportTimestampInRange("2020-01-01T00:00:00.000Z", range), true);
  assert.equal(customerReportTimestampInRange("2026-07-14T22:31:00.000Z", range), false);
});

test("range membership is inclusive and rejects malformed timestamps", () => {
  const range = buildCustomerReportPeriodRange({
    period: "daily",
    now: NOW,
    timeZone: "America/Denver",
  });

  assert.equal(customerReportTimestampInRange(range.startIso, range), true);
  assert.equal(customerReportTimestampInRange(range.endIso, range), true);
  assert.equal(customerReportTimestampInRange("2026-07-14T05:59:59.999Z", range), false);
  assert.equal(customerReportTimestampInRange("not-a-date", range), false);
});
