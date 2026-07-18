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
  assert.match(html, /Review paper-trading performance, scanner outcomes, and AI-assisted evidence review/);
  assert.match(html, /Paper-trading performance • Mountain Time/);
  assert.match(html, /Data status: Paper-trading data is current/);
  assert.match(html, /AI-assisted review/);
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

test("renders optional real-time AI review without mutation controls", () => {
  const html = renderCustomerReportsPageHtml(buildCustomerReportsPage({
    account: {},
    report: {
      period: "weekly",
      aiReview: { proposals: [] },
      realtimeAiReview: {
        status: "completed_readonly",
        reviewText: "Backtest tighter confidence thresholds before manual approval.",
        requiresBacktest: true,
        requiresOperatorApproval: true,
        automaticLogicMutationAllowed: false,
        orderPlacementAllowed: false,
      },
    },
  }));

  assert.match(html, /Real-Time AI Review/);
  assert.match(html, /Completed — read only/);
  assert.match(html, /Backtest tighter confidence thresholds/);
  assert.doesNotMatch(html, /Apply AI changes/);
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

  assert.match(html, /Historical Decision-Quality Proposals/);
  assert.match(html, /Review entry confirmation requirements/);
  assert.match(html, /Proposal Evidence Calibration/);
  assert.match(html, /Calibration History/);
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

  assert.match(html, /href="\/customer">Overview<\/a>/);
  assert.match(html, /href="\/customer\/reports" aria-current="page">Reports<\/a>/);
  assert.match(html, /href="\/customer\/watchlist">Watchlist<\/a>/);
  assert.doesNotMatch(html, />Home<\/a>|\/customer\/scanner\/under-five/);
  assert.match(html, /AI reviews scanner evidence/);
  assert.match(html, /cannot change scanner logic, approve its own proposals, bypass deterministic safety gates, contact a broker, or place trades/);
});
