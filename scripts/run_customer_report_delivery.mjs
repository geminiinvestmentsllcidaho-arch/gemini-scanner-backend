import { listCustomerAccountRecords } from "../src/scanner/customer_account_store.mjs";
import { runCustomerReportDeliveryForAccount } from "../src/scanner/customer_report_delivery_runner.mjs";
import { buildCustomerReportModel } from "../src/scanner/customer_report_model.mjs";
import { fetchAlpacaPaperAccountReadonly } from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";
import { buildCustomerZeroPaperAccountBridge } from "../src/scanner/customer_zero_paper_account_bridge.mjs";
import { readPaperTradePositionStateStoreDashboard } from "../src/scanner/paper_trade_position_state_store.mjs";
import { readScannerRankings } from "../src/scanner/ranking_store.mjs";

const now = new Date();
const accounts = listCustomerAccountRecords()
  .filter((account) => account?.emailVerified === true)
  .filter((account) => account?.status === "active");

const fetched = await fetchAlpacaPaperAccountReadonly();
const paperAccount = buildCustomerZeroPaperAccountBridge(fetched);
const positionLedger = readPaperTradePositionStateStoreDashboard();
const paperLedgerHistory = Array.isArray(positionLedger.records) ? positionLedger.records : [];
const rankingRoot = readScannerRankings();
const scannerEvents = Array.isArray(rankingRoot?.rankings) ? rankingRoot.rankings : [];

const results = [];
for (const account of accounts) {
  results.push(await runCustomerReportDeliveryForAccount(account, {
    now,
    baseUrl: process.env.PUBLIC_BASE_URL || "https://geminiscanner.net",
    buildReport: async ({ period, timeZone }) => buildCustomerReportModel({
      period,
      now,
      timeZone,
      weekStartsOn: 1,
      paperAccount,
      paperLedgerHistory,
      scannerEvents,
    }),
  }));
}

const rows = results.flatMap((result) => result.results ?? []);
const summary = {
  ok: rows.every((row) => row.status !== "failed"),
  version: "customer_report_delivery_manual_runner_v1",
  generatedAt: now.toISOString(),
  eligibleAccounts: accounts.length,
  delivered: rows.filter((row) => row.delivered === true).length,
  failed: rows.filter((row) => row.status === "failed").length,
  duplicateSkipped: rows.filter((row) => row.status === "duplicate_skipped").length,
  readOnly: true,
  paperOnly: true,
  brokerContact: false,
  orderPlacement: false,
  accountMutation: false,
  results,
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exitCode = 1;
