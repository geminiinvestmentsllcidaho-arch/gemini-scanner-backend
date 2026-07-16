import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerReportsPage,
  renderCustomerReportsPageHtml,
} from "../src/scanner/customer_reports_page.mjs";

test("builds customer reports page as lifetime read-only paper analytics", () => {
  const page = buildCustomerReportsPage({
    account: {
      displayPreferences: {
        locale: "en-US",
        timezone: "America/Denver",
      },
    },
    report: {
      period: "lifetime",
      status: "current_readonly",
      stale: false,
      performance: {
        startingBalance: 1000,
        endingBalance: 1125,
        totalPnl: 125,
        realizedPnl: 100,
        unrealizedPnl: 25,
        totalReturnPct: 12.5,
        maxDrawdown: 30,
        totalCapitalUsed: 500,
      },
      trades: {
        totalTrades: 4,
        winningTrades: 3,
        losingTrades: 1,
        winRatePct: 75,
        averageGain: 50,
        averageLoss: -25,
        averageHoldTime: "18m",
        averageDollarsPerTrade: 125,
      },
      scanner: {
        signalsGenerated: 9,
        enter: 3,
        exit: 2,
        wait: 2,
        doNotEnter: 1,
        blocked: 1,
        stale: 0,
        averageConfidence: 81,
        averagePotentialScore: 84,
        profitableSignals: 3,
        failedSignals: 1,
      },
      aiReview: {
        requiresBacktest: true,
        requiresOperatorApproval: true,
        proposals: [{
          category: "ranking_logic",
          severity: "medium",
          observation: "Average confidence is below the review floor.",
          proposal: "Backtest a higher confidence floor before approval.",
        }],
      },
      largestWinners: [{ symbol: "AAA", realizedPnl: 80 }],
      largestLosers: [{ symbol: "BBB", realizedPnl: -25 }],
      activity: [{
        timestamp: "2026-07-15T03:30:00.000Z",
        symbol: "AAA",
        action: "EXIT",
        realizedPnl: 80,
        status: "paper_closed",
      }],
    },
  });

  assert.equal(page.route, "/customer/reports");
  assert.equal(page.locale, "en-US");
  assert.equal(page.timeZone, "America/Denver");
  assert.equal(page.readOnly, true);
  assert.equal(page.paperOnly, true);

  const html = renderCustomerReportsPageHtml(page);
  assert.match(html, /<h1>Reports<\/h1>/);
  assert.match(html, /href="\/customer\/reports\?period=lifetime" aria-current="page" class="active"/);
  assert.match(html, /Starting balance/);
  assert.match(html, /\$1,000\.00/);
  assert.match(html, /Scanner accuracy/);
  assert.match(html, /Equity curve placeholder/);
  assert.match(html, /Comparison details will appear after enough paper-trading history is available\./);
  assert.match(html, /AAA/);
  assert.match(html, /Performance and scanner analytics from paper-trading activity/);
  assert.match(html, /Paper-trading performance • Mountain Time/);
  assert.match(html, /Data status: Paper-trading data is current/);
  assert.match(html, /Report Improvement Review/);
  assert.match(html, /Testing required before changes:<\/strong> Yes/);
  assert.match(html, /Manual approval required:<\/strong> Yes/);
  assert.match(html, /Backtest a higher confidence floor before approval/);
  assert.match(html, /Ranking quality · Review/);
  assert.match(html, /What we found:/);
  assert.match(html, /Suggested next step:/);
  assert.match(html, /Comparison details will appear after enough paper-trading history is available/);
});

test("renders stale empty report without fabricating activity", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    report: {
      period: "daily",
      status: "stale_readonly",
      stale: true,
      performance: {},
      trades: {},
      scanner: {},
      activity: [],
    },
  }));

  assert.match(html, /Data status: Waiting for current paper-trading data/);
  assert.match(html, /No in-range paper activity is available/);
  assert.match(html, /No data yet/);
  assert.doesNotMatch(html, /stale_readonly/);
  assert.doesNotMatch(html, /Unavailable/);
  assert.doesNotMatch(html, /undefined/);
});
