import fs from "node:fs";
import path from "node:path";

export const VERSION = "customer_report_delivery_ledger_v1";
export const DEFAULT_CUSTOMER_REPORT_DELIVERY_LEDGER_PATH =
  "runs/customer_report_delivery_ledger.jsonl";

function clean(value) {
  return String(value ?? "").trim();
}

export function readCustomerReportDeliveryRecords(
  ledgerPath = DEFAULT_CUSTOMER_REPORT_DELIVERY_LEDGER_PATH,
) {
  if (!fs.existsSync(ledgerPath)) return Object.freeze([]);
  const records = fs.readFileSync(ledgerPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return Object.freeze(records);
}

export function customerReportDeliveryKey(input = {}) {
  const accountId = clean(input.accountId);
  const period = clean(input.period).toLowerCase();
  const bucket = clean(input.bucket);
  const channel = clean(input.channel || "email").toLowerCase();

  if (!accountId || !period || !bucket || !channel) {
    throw new Error("customer_report_delivery_key_input_required");
  }

  return `${accountId}:${channel}:${period}:${bucket}`;
}

export function findCustomerReportDeliveryRecord(input = {}, options = {}) {
  const ledgerPath =
    clean(options.ledgerPath) || DEFAULT_CUSTOMER_REPORT_DELIVERY_LEDGER_PATH;
  const key = customerReportDeliveryKey(input);
  return readCustomerReportDeliveryRecords(ledgerPath)
    .find((record) => clean(record.key) === key) ?? null;
}

export function appendCustomerReportDeliveryRecord(input = {}, options = {}) {
  const ledgerPath =
    clean(options.ledgerPath) || DEFAULT_CUSTOMER_REPORT_DELIVERY_LEDGER_PATH;
  const key = customerReportDeliveryKey(input);
  const existing = findCustomerReportDeliveryRecord(input, { ledgerPath });

  if (existing) {
    return Object.freeze({
      ok: true,
      appended: false,
      duplicate: true,
      record: existing,
      ledgerPath,
    });
  }

  const now = options.now instanceof Date ? options.now : new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  const record = Object.freeze({
    version: VERSION,
    key,
    accountId: clean(input.accountId),
    channel: clean(input.channel || "email").toLowerCase(),
    period: clean(input.period).toLowerCase(),
    bucket: clean(input.bucket),
    status: clean(input.status || "delivered"),
    provider: clean(input.provider) || null,
    deliveryId: clean(input.deliveryId) || null,
    reason: clean(input.reason) || null,
    createdAt: now.toISOString(),
    readOnly: true,
    brokerContact: false,
    orderPlacement: false,
    accountMutation: false,
  });

  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return Object.freeze({
    ok: true,
    appended: true,
    duplicate: false,
    record,
    ledgerPath,
  });
}

export default {
  VERSION,
  DEFAULT_CUSTOMER_REPORT_DELIVERY_LEDGER_PATH,
  readCustomerReportDeliveryRecords,
  customerReportDeliveryKey,
  findCustomerReportDeliveryRecord,
  appendCustomerReportDeliveryRecord,
};
