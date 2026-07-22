import { customerReportDeliveryDuePeriods, customerReportDeliveryBucket } from "./customer_report_delivery_schedule.mjs";
import { findCustomerReportDeliveryRecord, appendCustomerReportDeliveryRecord } from "./customer_report_delivery_ledger.mjs";
import { deliverCustomerReportEmail } from "./customer_report_email_delivery.mjs";

export const VERSION = "customer_report_delivery_runner_v1";

function clean(value) {
  return String(value ?? "").trim();
}

function summaryFromReport(report = {}) {
  const performance = report.performance ?? {};
  const trades = report.trades ?? {};
  const scanner = report.scanner ?? {};
  return [
    `Status: ${clean(report.status) || "unavailable"}.`,
    `Paper records: ${Number(report.paperRecordCount) || 0}.`,
    `Symbols with realized P/L: ${Number(trades.tradesWithRealizedPnl ?? trades.totalTrades) || 0}.`,
    `Net paper P/L: ${performance.netProfitLoss ?? "not available"}.`,
    `Scanner signals: ${Number(scanner.totalSignals) || 0}.`,
  ].join(" ");
}

export async function runCustomerReportDeliveryForAccount(account = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date");

  const accountId = clean(account.id);
  const email = clean(account.email).toLowerCase();
  if (!accountId || !email) {
    return Object.freeze({
      ok: false,
      accountId: accountId || null,
      reason: "account_identity_required",
      results: Object.freeze([]),
    });
  }

  const timeZone = clean(options.timeZone)
    || clean(account?.displayPreferences?.timezone)
    || "America/New_York";
  const duePeriods = customerReportDeliveryDuePeriods(account, { now, timeZone });
  const buildReport = options.buildReport;
  const deliverEmail = options.deliverEmail || deliverCustomerReportEmail;
  const findRecord = options.findRecord || findCustomerReportDeliveryRecord;
  const appendRecord = options.appendRecord || appendCustomerReportDeliveryRecord;
  const baseUrl = clean(options.baseUrl) || "https://geminiscanner.net";
  const results = [];

  if (typeof buildReport !== "function") {
    return Object.freeze({
      ok: false,
      accountId,
      reason: "report_builder_required",
      duePeriods,
      results: Object.freeze(results),
    });
  }

  for (const period of duePeriods) {
    const bucket = customerReportDeliveryBucket(period, now, timeZone);
    const keyInput = { accountId, channel: "email", period, bucket };
    const existing = findRecord(keyInput, { ledgerPath: options.ledgerPath });

    if (existing) {
      results.push(Object.freeze({
        period,
        bucket,
        status: "duplicate_skipped",
        delivered: false,
        duplicate: true,
      }));
      continue;
    }

    const report = await buildReport({ account, period, now, timeZone });
    const reportUrl = `${baseUrl.replace(/\/+$/, "")}/customer/reports?period=${encodeURIComponent(period)}`;
    const delivery = await deliverEmail({
      email,
      period,
      reportUrl,
      generatedAt: now.toISOString(),
      summary: summaryFromReport(report),
    }, options.emailOptions ?? {});

    if (delivery?.delivered === true) {
      appendRecord({
        ...keyInput,
        status: "delivered",
        provider: delivery?.provider,
        deliveryId: delivery?.deliveryId,
        reason: delivery?.reason,
      }, {
        ledgerPath: options.ledgerPath,
        now,
      });
    }

    results.push(Object.freeze({
      period,
      bucket,
      status: delivery?.delivered === true ? "delivered" : "failed",
      delivered: delivery?.delivered === true,
      duplicate: false,
      provider: delivery?.provider ?? null,
      deliveryId: delivery?.deliveryId ?? null,
      reason: delivery?.reason ?? null,
    }));
  }

  return Object.freeze({
    ok: true,
    accountId,
    duePeriods,
    results: Object.freeze(results),
    readOnly: true,
    paperOnly: true,
    brokerContact: false,
    orderPlacement: false,
    accountMutation: false,
  });
}

export default {
  VERSION,
  runCustomerReportDeliveryForAccount,
};
