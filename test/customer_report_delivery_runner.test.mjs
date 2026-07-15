import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCustomerReportDeliveryForAccount } from "../src/scanner/customer_report_delivery_runner.mjs";

function ledgerPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "customer-report-delivery-runner-"));
  return path.join(dir, "ledger.jsonl");
}

const account = {
  id: "customer-1",
  email: "customer@example.com",
  displayPreferences: { timezone: "America/Denver" },
  notificationPreferences: {
    reportEmailEnabled: true,
    reportDeliveryPeriods: ["daily"],
  },
};

test("delivers one due read-only report and records the outcome", async () => {
  const ledger = ledgerPath();
  const result = await runCustomerReportDeliveryForAccount(account, {
    now: new Date("2026-07-16T00:05:00.000Z"),
    ledgerPath: ledger,
    buildReport: async ({ period }) => ({
      period,
      status: "current_readonly",
      paperRecordCount: 2,
      performance: { netProfitLoss: 12.34 },
      trades: { totalTrades: 1 },
      scanner: { totalSignals: 3 },
    }),
    deliverEmail: async (message) => {
      assert.equal(message.period, "daily");
      assert.match(message.summary, /Net paper P\/L: 12\.34/);
      return { ok: true, delivered: true, provider: "resend", deliveryId: "delivery-1" };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.duePeriods, ["daily"]);
  assert.equal(result.results[0].status, "delivered");
  assert.equal(result.orderPlacement, false);
  assert.equal(fs.readFileSync(ledger, "utf8").trim().split("\n").length, 1);
});

test("skips a previously ledgered delivery bucket", async () => {
  const ledger = ledgerPath();
  let deliveries = 0;
  const options = {
    now: new Date("2026-07-16T00:05:00.000Z"),
    ledgerPath: ledger,
    buildReport: async () => ({ status: "current_readonly" }),
    deliverEmail: async () => {
      deliveries += 1;
      return { ok: true, delivered: true, provider: "resend", deliveryId: `delivery-${deliveries}` };
    },
  };

  const first = await runCustomerReportDeliveryForAccount(account, options);
  const second = await runCustomerReportDeliveryForAccount(account, options);

  assert.equal(first.results[0].status, "delivered");
  assert.equal(second.results[0].status, "duplicate_skipped");
  assert.equal(deliveries, 1);
  assert.equal(fs.readFileSync(ledger, "utf8").trim().split("\n").length, 1);
});

test("fails closed when no report builder is supplied", async () => {
  const result = await runCustomerReportDeliveryForAccount(account, {
    now: new Date("2026-07-16T00:05:00.000Z"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "report_builder_required");
});

test("failed email delivery is not ledgered and remains retryable", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-report-delivery-retry-"));
  const ledgerPath = path.join(dir, "ledger.jsonl");
  const account = {
    id: "acct-retry",
    email: "retry@example.com",
    displayPreferences: { timezone: "America/Denver" },
    notificationPreferences: {
      reportEmailEnabled: true,
      reportDeliveryPeriods: ["daily"],
    },
  };
  const now = new Date("2026-07-16T00:05:00.000Z");
  const options = {
    now,
    ledgerPath,
    baseUrl: "https://geminiscanner.net",
    buildReport: async () => ({ metrics: {} }),
    deliverEmail: async () => ({
      delivered: false,
      provider: "resend",
      reason: "temporary_provider_failure",
    }),
  };

  const first = await runCustomerReportDeliveryForAccount(account, options);
  const second = await runCustomerReportDeliveryForAccount(account, options);

  assert.equal(first.results[0].status, "failed");
  assert.equal(second.results[0].status, "failed");
  assert.equal(first.results[0].duplicate, false);
  assert.equal(second.results[0].duplicate, false);
  assert.equal(fs.existsSync(ledgerPath), false);
});
