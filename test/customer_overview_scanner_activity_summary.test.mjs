import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
} from "../src/scanner/customer_scanner_hub.mjs";

test("customer Overview shows only active or inactive scheduler summaries", () => {
  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
    route: "/customer",
    premarketAutoStatus: {
      running: true,
      schedulerState: "sleeping",
      scanCount: 12,
      lastCandidateCount: 4,
    },
    postMarketAutoStatus: {
      running: false,
      schedulerState: "scheduled",
      runCount: 7,
      skippedCount: 2,
    },
  }));

  assert.match(html, /Automatic premarket scanner[\s\S]*?<h2>Active<\/h2>/);
  assert.match(html, /Automatic post-market scanner[\s\S]*?<h2>Inactive<\/h2>/);
  assert.doesNotMatch(html, /Automatic scans/);
  assert.doesNotMatch(html, /Last candidates/);
  assert.doesNotMatch(html, /Completed cycles/);
  assert.doesNotMatch(html, /Skipped cycles/);
});

test("customer Scanner tab retains full scheduler status details", () => {
  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
    route: "/customer/scanner",
    premarketAutoStatus: {
      running: true,
      schedulerState: "sleeping",
      session: { active: false },
      scanCount: 12,
      lastCandidateCount: 4,
    },
    postMarketAutoStatus: {
      running: true,
      timerScheduled: true,
      schedulerState: "scheduled",
      runCount: 7,
      skippedCount: 2,
    },
  }));

  assert.match(html, /Automatic scans/);
  assert.match(html, /Last candidates/);
  assert.match(html, /Completed cycles/);
  assert.match(html, /Skipped cycles/);
  assert.doesNotMatch(html, /premarket-overview-status/);
  assert.doesNotMatch(html, /postmarket-overview-status/);
});
