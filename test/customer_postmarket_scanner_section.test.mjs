import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
} from "../src/scanner/customer_scanner_hub.mjs";
import {
  buildPublicHomepage,
  renderPublicHomepageHtml,
} from "../src/scanner/public_homepage.mjs";

test("customer scanner page renders separate automatic post-market section", () => {
  const hub = buildCustomerScannerHub({
    route: "/customer/scanner",
    premarketAutoStatus: {
      running: true,
      schedulerState: "sleeping",
      session: { active: false },
    },
    postMarketAutoStatus: {
      enabled: true,
      running: true,
      timerScheduled: true,
      schedulerState: "scheduled",
      lastStatus: "scheduled",
      runCount: 2,
      skippedCount: 1,
      lastCompletedAt: "2026-07-17T21:00:00.000Z",
      lastResult: { status: "completed_readonly" },
    },
  });

  assert.equal(hub.postMarketAutoStatus.running, true);
  const html = renderCustomerScannerHubHtml(hub);
  assert.match(html, /Automatic post-market scanner/);
  assert.match(html, /Scheduler engaged/);
  assert.match(html, /Automatic timer active/);
  assert.match(html, /Completed cycles/);
  assert.match(html, /AI review may be triggered by new observations/);
  assert.match(html, /No order placement or scanner-logic mutation/);
});

test("public landing page identifies post-market scanner as automatic", () => {
  const html = renderPublicHomepageHtml(buildPublicHomepage());
  assert.match(html, /Post-market scanner/);
  assert.match(html, /Post-market scanner<\/span><strong>Automatic/);
  assert.doesNotMatch(html, /After-hours scanner<\/span><strong>Coming soon/);
});
