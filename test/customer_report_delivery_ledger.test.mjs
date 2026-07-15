import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendCustomerReportDeliveryRecord,
  customerReportDeliveryKey,
  findCustomerReportDeliveryRecord,
  readCustomerReportDeliveryRecords,
} from "../src/scanner/customer_report_delivery_ledger.mjs";

function tempLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "customer-report-delivery-ledger-"));
  return path.join(dir, "ledger.jsonl");
}

test("builds a stable customer report delivery idempotency key", () => {
  assert.equal(
    customerReportDeliveryKey({
      accountId: "customer-1",
      channel: "email",
      period: "weekly",
      bucket: "2026-07-13",
    }),
    "customer-1:email:weekly:2026-07-13",
  );
});

test("appends one bounded read-only delivery record", () => {
  const ledgerPath = tempLedger();
  const result = appendCustomerReportDeliveryRecord({
    accountId: "customer-1",
    channel: "email",
    period: "daily",
    bucket: "2026-07-15",
    status: "delivered",
    provider: "resend",
    deliveryId: "delivery-1",
  }, {
    ledgerPath,
    now: new Date("2026-07-16T00:05:00.000Z"),
  });

  assert.equal(result.appended, true);
  assert.equal(result.record.readOnly, true);
  assert.equal(result.record.orderPlacement, false);
  assert.equal(result.record.accountMutation, false);
  assert.equal(readCustomerReportDeliveryRecords(ledgerPath).length, 1);
});

test("blocks duplicate delivery records for the same account period and bucket", () => {
  const ledgerPath = tempLedger();
  const input = {
    accountId: "customer-1",
    channel: "email",
    period: "daily",
    bucket: "2026-07-15",
    status: "delivered",
  };

  const first = appendCustomerReportDeliveryRecord(input, { ledgerPath });
  const second = appendCustomerReportDeliveryRecord(input, { ledgerPath });

  assert.equal(first.appended, true);
  assert.equal(second.appended, false);
  assert.equal(second.duplicate, true);
  assert.equal(readCustomerReportDeliveryRecords(ledgerPath).length, 1);
  assert.equal(
    findCustomerReportDeliveryRecord(input, { ledgerPath })?.key,
    first.record.key,
  );
});
