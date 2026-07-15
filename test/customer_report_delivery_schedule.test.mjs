import test from "node:test";
import assert from "node:assert/strict";
import {
  customerReportDeliveryBucket,
  customerReportDeliveryDuePeriods,
} from "../src/scanner/customer_report_delivery_schedule.mjs";

const account = {
  displayPreferences: { timezone: "America/Denver" },
  notificationPreferences: {
    reportEmailEnabled: true,
    reportDeliveryPeriods: ["daily", "weekly", "monthly", "yearly", "ytd", "lifetime"],
  },
};

test("returns no due periods when email delivery is disabled", () => {
  const due = customerReportDeliveryDuePeriods({
    ...account,
    notificationPreferences: {
      ...account.notificationPreferences,
      reportEmailEnabled: false,
    },
  }, {
    now: new Date("2026-07-18T00:00:00.000Z"),
  });
  assert.deepEqual(due, []);
});

test("daily ytd and lifetime become due in the bounded evening window", () => {
  const due = customerReportDeliveryDuePeriods(account, {
    now: new Date("2026-07-16T00:05:00.000Z"),
  });
  assert.deepEqual(due, ["daily", "ytd", "lifetime"]);
});

test("weekly delivery becomes due Friday evening in the customer timezone", () => {
  const due = customerReportDeliveryDuePeriods(account, {
    now: new Date("2026-07-18T00:05:00.000Z"),
  });
  assert.deepEqual(due, ["daily", "weekly", "ytd", "lifetime"]);
});

test("monthly and yearly delivery use the first local calendar day", () => {
  const due = customerReportDeliveryDuePeriods(account, {
    now: new Date("2027-01-02T01:05:00.000Z"),
  });
  assert.deepEqual(due, ["daily", "weekly", "monthly", "yearly", "ytd", "lifetime"]);
});

test("delivery buckets are stable for idempotency", () => {
  const now = new Date("2026-07-18T00:05:00.000Z");
  assert.equal(customerReportDeliveryBucket("daily", now, "America/Denver"), "2026-07-17");
  assert.equal(customerReportDeliveryBucket("weekly", now, "America/Denver"), "2026-07-13");
  assert.equal(customerReportDeliveryBucket("monthly", now, "America/Denver"), "2026-07");
  assert.equal(customerReportDeliveryBucket("yearly", now, "America/Denver"), "2026");
  assert.equal(customerReportDeliveryBucket("lifetime", now, "America/Denver"), "lifetime");
});
