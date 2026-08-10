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
        requiresOperatorApproval: false,
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
  assert.match(html, /Review paper-trading performance, scanner outcomes, and AI-assisted evidence review/);
  assert.match(html, /Paper-trading performance • Mountain Time/);
  assert.match(html, /Data status: Paper-trading data is current/);
  assert.match(html, /AI-assisted review/);
  assert.match(html, /Testing required before changes:<\/strong> Yes/);
  assert.doesNotMatch(html, /Manual approval required/);
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

test("renders optional real-time AI review without mutation controls", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    account: {},
    report: {
      period: "weekly",
      aiReview: { proposals: [] },
      realtimeAiReview: {
        status: "completed_readonly",
        reviewText: "Backtest tighter confidence thresholds before use.",
        requiresBacktest: true,
        requiresOperatorApproval: false,
        automaticLogicMutationAllowed: false,
        orderPlacementAllowed: false,
      },
    },
  }));

  assert.match(html, /Real-time AI review/);
  assert.match(html, /Review complete/);
  assert.match(html, /AI reviews your current paper-trading report and highlights the most important takeaways/);
  assert.match(html, /View detailed AI notes/);
  assert.match(html, /Advanced review details for transparency and support/);
  assert.match(html, /class="ai-technical-notes"/);
  assert.match(html, /Backtest tighter confidence thresholds/);
  assert.match(html, /Any suggested strategy change must be tested before use/);
  assert.doesNotMatch(html, /Your approval is also required before any change can be made/);
  assert.doesNotMatch(html, /Apply AI changes/);
});

test("real-time AI review presents current holdings and historical simulations in plain English", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    account: {},
    report: {
      period: "weekly",
      currentBrokerPositions: [{
        symbol: "BTG",
        qty: 1,
        side: "long",
        averageEntryPrice: 4.12,
        currentPrice: 4.00,
        unrealizedPl: -0.12,
      }],
      historicalSimulatedOpenPositions: [{
        symbol: "SOFI",
        qty: 198,
        averageEntryPrice: 10.1,
      }],
      realtimeAiReview: {
        status: "completed_readonly",
        reviewText: "Detailed internal evidence remains available.",
        requiresBacktest: false,
        requiresOperatorApproval: false,
      },
    },
  }));

  assert.match(html, /Current paper holdings/);
  assert.match(html, /positions currently reported by your connected Alpaca paper account/);
  assert.match(html, /BTG/);
  assert.match(html, /Avg\. entry \$4\.12/);
  assert.match(html, /Current \$4\.00/);
  assert.match(html, /P\/L -\$0\.12/);
  assert.match(html, /Historical simulation data/);
  assert.match(html, /1 historical simulated position is stored for testing and audit history/);
  assert.match(html, /not part of your current Alpaca paper holdings/);
  assert.match(html, /View detailed AI notes/);
  assert.match(html, /Detailed internal evidence remains available/);
});


test("renders current report performance field names", () => {
  const page = buildCustomerReportsPage({
    report: {
      period: "lifetime",
      range: { label: "Lifetime" },
      stale: false,
      status: "current_readonly",
      performance: {
        startingBalance: 100000,
        endingBalance: 100005.81,
        totalPl: 5.81,
        realizedPl: 0,
        unrealizedPl: 5.81,
        totalReturnPct: 0.01,
        maxDrawdown: 0,
        totalCapitalUsed: 1999.8,
      },
      trades: {},
      scanner: {},
      activity: [],
      largestWinners: [],
      largestLosers: [],
      equityCurve: [],
      aiReview: {},
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    },
    account: { displayPreferences: { locale: "en-US", timeZone: "America/Denver" } },
  });
  const html = renderCustomerReportsPageHtml(page);
  assert.match(html, /\$5\.81/);
  assert.match(html, /\$100,005\.81/);
});



test("labels broker-backed selected-period and current account performance scopes explicitly", () => {
  const page = buildCustomerReportsPage({
    report: {
      period: "daily",
      range: { label: "Daily" },
      stale: false,
      status: "current_readonly",
      freshnessSource: "alpaca_paper_readonly_observation",
      performance: {
        startingBalance: null,
        endingBalance: 100050,
        totalPl: 50,
        realizedPl: 25,
        unrealizedPl: 25,
        totalReturnPct: null,
        maxDrawdown: null,
        totalCapitalUsed: 600,
      },
      trades: {},
      scanner: {},
      activity: [],
      largestWinners: [],
      largestLosers: [],
      equityCurve: [],
      aiReview: {},
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    },
    account: { displayPreferences: { locale: "en-US", timeZone: "America/Denver" } },
  });
  const html = renderCustomerReportsPageHtml(page);
  assert.match(html, /Broker-backed realized P\/L follows the selected report period/);
  assert.match(html, /Current account equity/);
  assert.match(html, /Selected-period realized \+ current unrealized P\/L/);
  assert.match(html, /Realized P\/L \(selected period\)/);
  assert.match(html, /Current unrealized P\/L/);
  assert.match(html, /Historical simulated capital used/);
  assert.doesNotMatch(html, />Ending balance</);
  assert.doesNotMatch(html, />Total P\/L</);
});

test("preserves legacy performance labels when broker-backed history is absent", () => {
  const page = buildCustomerReportsPage({
    report: {
      period: "daily",
      range: { label: "Daily" },
      stale: false,
      status: "current_readonly",
      freshnessSource: "paper_position_snapshot",
      performance: {
        startingBalance: 1000,
        endingBalance: 1010,
        totalPl: 10,
        realizedPl: 8,
        unrealizedPl: 2,
        totalReturnPct: 1,
        maxDrawdown: 3,
        totalCapitalUsed: 500,
      },
      trades: {},
      scanner: {},
      activity: [],
      largestWinners: [],
      largestLosers: [],
      equityCurve: [],
      aiReview: {},
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    },
    account: { displayPreferences: { locale: "en-US", timeZone: "America/Denver" } },
  });
  const html = renderCustomerReportsPageHtml(page);
  assert.match(html, />Ending balance</);
  assert.match(html, />Total P\/L</);
  assert.match(html, />Realized P\/L</);
  assert.match(html, />Unrealized P\/L</);
  assert.match(html, />Capital used</);
  assert.doesNotMatch(html, /Broker-backed realized P\/L follows the selected report period/);
});

test("renders historical decision-quality proposals and calibration review read only", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    account: { displayPreferences: { locale: "en-US", timezone: "America/Denver" } },
    report: {
      period: "lifetime",
      decisionQualityProposals: {
        proposalCount: 1,
        returnedProposalCount: 1,
        sourceReviewRequiredCount: 1,
        automaticLearningAllowed: false,
        proposals: [{
          proposalType: "REDUCE_FALSE_POSITIVES",
          title: "Review entry confirmation requirements",
          targetArea: "entry_confirmation",
          suggestedDirection: "Require stronger confirmation evidence before ENTER decisions.",
          riskLevel: "high",
          evidence: {
            symbol: "XYZ",
            rankingConfidence: 0.82,
            readonlyPotentialScore: 73,
          },
        }],
      },
      proposalCalibrationReview: {
        analyzedProposalCount: 6,
        proposalTypeGroupCount: 1,
        targetAreaGroupCount: 1,
        calibrationReviewQueueCount: 1,
        marketOpenObservationsOnly: true,
        freshSourceObservationsOnly: true,
        calibrationReviewQueue: [{
          groupKey: "entry_confirmation",
          calibrationReviewStatus: "HIGH_CALIBRATION_CONCERN",
          sampleCount: 6,
          calibrationBand: "EARLY_SAMPLE",
          disagreementRatePct: 66.67,
          averageRankingConfidence: 0.8,
          uniqueSymbolCount: 4,
          uniqueScanCount: 6,
          observableSourceCount: 5,
          staleSourceCount: 1,
        }],
      },
    },
    proposalCalibrationHistory: {
      recordCount: 1,
      localJsonlOnly: true,
      automaticLearningAllowed: false,
      scannerLogicMutationAllowed: false,
      records: [{
        generatedAt: "2026-07-16T20:00:00.000Z",
        marketOpenObservationsOnly: true,
        freshSourceObservationsOnly: true,
        analyzedProposalCount: 100,
        calibrationReviewQueueCount: 1,
        proposalTypeGroupCount: 2,
        targetAreaGroupCount: 2,
      }],
    },
  }));

  assert.match(html, /Historical decision-quality proposals/);
  assert.match(html, /Review entry confirmation requirements/);
  assert.match(html, /Proposal evidence calibration/);
  assert.match(html, /Calibration history/);
  assert.match(html, /Saved snapshots/);
  assert.match(html, /Duplicate snapshots skipped/);
  assert.match(html, /High Calibration Concern/);
  assert.match(html, /66\.67%/);
  assert.match(html, /Observable sources:<\/strong> 5/);
  assert.match(html, /Stale sources:<\/strong> 1/);
  assert.match(html, /Market-open evidence/);
  assert.match(html, /Fresh-source evidence/);
  assert.match(html, /Only/);
  assert.match(html, /Automatic learning/);
  assert.match(html, /Locked/);
  assert.match(html, /Scanner mutation locked/);
  assert.doesNotMatch(html, /Apply proposal/);
  assert.doesNotMatch(html, /Enable automatic learning/);
});

test("customer reports uses the shared primary navigation and accurate AI limits", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    report: { period: "lifetime", performance: {}, trades: {}, scanner: {}, activity: [] },
  }));

  assert.match(html, /href="\/customer"[^>]*>[\s\S]*?Overview[\s\S]*?<\/a>/);
  assert.match(html, /href="\/customer\/reports"[^>]*aria-current="page"[^>]*>[\s\S]*?Reports[\s\S]*?<\/a>/);
  assert.match(html, /href="\/customer\/watchlist"[^>]*>[\s\S]*?Watchlist[\s\S]*?<\/a>/);
  assert.doesNotMatch(html, />Home<\/a>|\/customer\/scanner\/under-five/);
  assert.match(html, /AI reviews scanner evidence/);
  assert.match(html, /cannot change scanner logic, approve its own proposals, bypass deterministic safety gates, contact a broker, or place trades/);
});


test("renders numeric lifecycle hold duration in a human-readable form", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    report: {
      period: "lifetime",
      performance: {},
      trades: {
        lifecycleSourceAvailable: true,
        totalTrades: 1,
        averageHoldTimeMs: 90061000,
      },
      scanner: {},
      activity: [],
    },
  }));

  assert.match(html, /Average hold time/);
  assert.match(html, /1d 1h/);
  assert.doesNotMatch(html, /90061000/);
});

test("customer reports exposes focused in-page section navigation", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    report: { period: "lifetime", performance: {}, trades: {}, scanner: {}, activity: [] },
  }));

  assert.match(html, /aria-label="Report sections"/);
  assert.equal((html.match(/class="report-section-icon"/g) || []).length, 11);
  assert.match(html, /href="#performance-summary"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Performance<\/span><\/a>/);
  assert.match(html, /href="#trade-statistics"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Trades<\/span><\/a>/);
  assert.match(html, /href="#scanner-accuracy"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Scanner<\/span><\/a>/);
  assert.match(html, /href="#winners-losers"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Winners &amp; Losers<\/span><\/a>/);
  assert.match(html, /href="#ai-review"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>AI Review<\/span><\/a>/);
  assert.match(html, /href="#decision-quality"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Proposals<\/span><\/a>/);
  assert.match(html, /href="#calibration"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Calibration<\/span><\/a>/);
  assert.match(html, /href="#calibration-history"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>History<\/span><\/a>/);
  assert.match(html, /href="#realtime-ai-review"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Real-Time AI<\/span><\/a>/);
  assert.match(html, /href="#detailed-activity"><span class="report-section-icon"><svg[^>]*>.*?<\/svg><\/span><span>Historical Activity<\/span><\/a>/);
  assert.match(html, /id="performance-summary"/);
  assert.match(html, /id="trade-statistics"/);
  assert.match(html, /id="scanner-accuracy"/);
  assert.match(html, /id="winners-losers"/);
  assert.match(html, /id="ai-review"/);
  assert.match(html, /id="decision-quality"/);
  assert.match(html, /id="calibration"/);
  assert.match(html, /id="calibration-history"/);
  assert.match(html, /id="realtime-ai-review"/);
  assert.match(html, /id="detailed-activity"/);
});


test("warns when broker history reaches the fetch limit", () => {
  const page = buildCustomerReportsPage({ report: {
    period: "lifetime", range: { label: "Lifetime" }, stale: false, status: "current_readonly",
    freshnessSource: "alpaca_paper_readonly_observation",
    brokerHistoryCompleteness: { historyLimit: 500, sourceRecordCount: 500, historyLimitReached: true, historyComplete: false, historyPossiblyTruncated: true },
    performance: { startingBalance: null, endingBalance: 100000, realizedPl: 10, unrealizedPl: 5, totalPl: 15, totalReturnPct: null, totalCapitalUsed: 0, maxDrawdown: null },
    currentBrokerPositions: [], trades: {}, scanner: {}, largestWinners: [], largestLosers: [], activity: [], equityCurve: []
  }})
  const html = renderCustomerReportsPageHtml(page)
  assert.match(html, /Broker order history reached the 500-order fetch limit/)
  assert.match(html, /Older paper orders may not be included/)
})
