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


test("post-market next activation uses the authoritative schedule contract across scheduler states", () => {
  const cases = [
    {
      schedulerState: "scan_due",
      nextCycleAt: "2026-07-16T20:30:00.000Z",
    },
    {
      schedulerState: "final_cycle_due",
      nextCycleAt: "2026-07-20T20:15:00.000Z",
    },
    {
      schedulerState: "weekend_sleep",
      nextCycleAt: "2026-07-20T20:15:00.000Z",
    },
    {
      schedulerState: "market_closed_no_session",
      nextCycleAt: "2026-07-06T20:15:00.000Z",
    },
  ];

  for (const item of cases) {
    const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
      route: "/customer/scanner",
      postMarketAutoStatus: {
        enabled: true,
        running: true,
        timerScheduled: true,
        schedulerState: item.schedulerState,
        lastStatus: item.schedulerState,
        lastPlan: {
          schedulerState: item.schedulerState,
          nextCycleAt: item.nextCycleAt,
        },
      },
    }));

    assert.match(
      html,
      new RegExp(item.schedulerState.replaceAll("_", " ").toUpperCase()),
    );
    assert.doesNotMatch(
      html,
      /<span>Next activation<\/span><b>Unavailable<\/b>/,
    );
  }
});


test("post-market customer status uses the authoritative nested scheduler state", () => {
  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
    route: "/customer/scanner",
    postMarketAutoStatus: {
      enabled: true,
      running: true,
      timerScheduled: true,
      lastStatus: "scheduled",
      lastPlan: {
        schedulerState: "weekend_sleep",
        nextCycleAt: "2026-07-20T20:15:00.000Z",
      },
    },
  }));

  assert.match(html, /WEEKEND SLEEP/);
  assert.doesNotMatch(
    html,
    /<strong>SCHEDULED<\/strong>/,
  );
  assert.doesNotMatch(
    html,
    /<span>Next activation<\/span><b>Unavailable<\/b>/,
  );
});

test("post-market next activation preserves legacy wake timestamp compatibility", () => {
  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
    route: "/customer/scanner",
    postMarketAutoStatus: {
      enabled: true,
      running: true,
      timerScheduled: true,
      schedulerState: "scheduled",
      lastPlan: {
        nextWakeAt: "2026-07-20T20:15:00.000Z",
      },
    },
  }));

  assert.doesNotMatch(
    html,
    /<span>Next activation<\/span><b>Unavailable<\/b>/,
  );
});

test("public landing page identifies post-market scanner as automatic", () => {
  const html = renderPublicHomepageHtml(buildPublicHomepage());
  assert.match(html, /Post-market scanner/);
  assert.match(html, /Post-market scanner<\/span><strong>Automatic/);
  assert.doesNotMatch(html, /After-hours scanner<\/span><strong>Coming soon/);
});
