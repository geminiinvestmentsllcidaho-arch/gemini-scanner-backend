import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildDecisionQualityProposalReport,
} from "../src/scanner/decision_quality_proposal_generation.mjs";

function reviewItem(qualityClass, overrides = {}) {
  return {
    key: `${qualityClass}-key`,
    originScanId: "scan-1",
    originEventAt: "2026-07-16T14:00:00.000Z",
    symbol: overrides.symbol ?? "ABC",
    decision: overrides.decision ?? "ENTER",
    outcomeClassification: overrides.outcomeClassification ?? "UNKNOWN",
    qualityClass,
    latestReturnPct: overrides.latestReturnPct ?? -1,
    maxFavorablePct: overrides.maxFavorablePct ?? 0.2,
    maxAdversePct: overrides.maxAdversePct ?? -1.2,
    blockingFlags: overrides.blockingFlags ?? ["wide_spread"],
  };
}

test("generates bounded review-only proposals from decision quality classes", () => {
  const report = buildDecisionQualityProposalReport({
    version: "decision_quality_classification_v1",
    reviewRequiredCount: 5,
    reviewQueue: [
      reviewItem("FALSE_POSITIVE"),
      reviewItem("MISSED_OPPORTUNITY", { decision: "DO_NOT_ENTER" }),
      reviewItem("LATE_DECISION", { decision: "WAIT" }),
      reviewItem("LATE_ENTRY"),
      reviewItem("NEAR_MISS"),
    ],
  }, {
    now: "2026-07-16T15:00:00.000Z",
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.proposalCount, 5);
  assert.deepEqual(
    report.proposals.map((row) => row.proposalType),
    [
      "REDUCE_FALSE_POSITIVES",
      "REDUCE_MISSED_OPPORTUNITIES",
      "IMPROVE_DECISION_TIMING",
      "IMPROVE_ENTRY_TIMING",
      "REVIEW_INCONCLUSIVE_BOUNDARIES",
    ],
  );
  assert.equal(report.proposals[0].requiresHumanReview, true);
  assert.equal(report.proposals[0].requiresSeparateApproval, true);
  assert.equal(report.proposals[0].implementationIncluded, false);
  assert.equal(report.proposals[0].patchIncluded, false);
});


test("propagates fresh-source observability metadata into review-only proposals", () => {
  const report = buildDecisionQualityProposalReport({
    version: "decision_quality_classification_v1",
    marketOpenObservationsOnly: true,
    freshSourceObservationsOnly: true,
    reviewRequiredCount: 1,
    reviewQueue: [{
      key: "scan-fresh:ABC",
      originScanId: "scan-fresh",
      originEventAt: "2026-07-16T14:00:00.000Z",
      originMarketOpen: true,
      originSourceStale: false,
      originObservable: true,
      symbol: "ABC",
      decision: "ENTER",
      outcomeClassification: "FALSE_POSITIVE_ENTER",
      qualityClass: "FALSE_POSITIVE",
      latestReturnPct: -2.4,
      maxFavorablePct: 0.3,
      maxAdversePct: -3.1,
      blockingFlags: [],
    }],
  });

  assert.equal(report.marketOpenObservationsOnly, true);
  assert.equal(report.freshSourceObservationsOnly, true);
  assert.equal(report.proposalCount, 1);
  assert.equal(report.proposals[0].sourceMarketOpen, true);
  assert.equal(report.proposals[0].sourceStale, false);
  assert.equal(report.proposals[0].sourceObservable, true);
  assert.equal(report.proposals[0].proposalOnly, true);
  assert.equal(report.proposals[0].implementationIncluded, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});


test("keeps every proposal and report mutation lock closed", () => {
  const report = buildDecisionQualityProposalReport({
    reviewQueue: [reviewItem("FALSE_POSITIVE")],
  });

  assert.equal(report.proposalGenerationAllowed, true);
  assert.equal(report.proposalOnly, true);
  assert.equal(report.humanReviewRequired, true);
  assert.equal(report.separateApprovalRequired, true);
  assert.equal(report.implementationIncluded, false);
  assert.equal(report.patchIncluded, false);
  assert.equal(report.automaticLearningAllowed, false);
  assert.equal(report.automaticPatchAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.proposals[0].scannerLogicMutationAllowed, false);
});

test("ignores non-actionable quality classes and respects proposal bounds", () => {
  const report = buildDecisionQualityProposalReport({
    reviewRequiredCount: 4,
    reviewQueue: [
      reviewItem("STRONG_DECISION"),
      reviewItem("PENDING"),
      reviewItem("UNCLASSIFIED", { symbol: "ZZZ" }),
      reviewItem("NEAR_MISS", { symbol: "AAA" }),
    ],
  }, {
    maxProposals: 1,
  });

  assert.equal(report.proposalCount, 2);
  assert.equal(report.returnedProposalCount, 1);
  assert.equal(report.proposals[0].proposalType, "IMPROVE_CLASSIFICATION_COVERAGE");
  assert.equal(report.sourceQueueCount, 4);
});
