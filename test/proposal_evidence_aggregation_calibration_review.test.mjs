import assert from "node:assert/strict";
import test from "node:test";

import {
  VERSION,
  buildProposalEvidenceAggregationCalibrationReview,
} from "../src/scanner/proposal_evidence_aggregation_calibration_review.mjs";

function proposal(index, overrides = {}) {
  return {
    proposalId: `p-${index}`,
    proposalType: overrides.proposalType ?? "REDUCE_FALSE_POSITIVES",
    targetArea: overrides.targetArea ?? "entry_confirmation",
    sourceKey: `key-${index}`,
    sourceScanId: overrides.sourceScanId ?? `scan-${index}`,
    evidence: {
      symbol: overrides.symbol ?? `S${index}`,
      rankingConfidence: overrides.rankingConfidence ?? 0.8,
      readonlyPotentialScore: overrides.readonlyPotentialScore ?? 75,
      latestReturnPct: overrides.latestReturnPct ?? -1,
      maxFavorablePct: overrides.maxFavorablePct ?? 0.2,
      maxAdversePct: overrides.maxAdversePct ?? -1.2,
      blockingFlags: overrides.blockingFlags ?? ["wide_spread"],
    },
  };
}

test("aggregates proposal evidence by proposal type and target area", () => {
  const report = buildProposalEvidenceAggregationCalibrationReview({
    version: "decision_quality_proposal_generation_v1",
    proposalCount: 3,
    proposals: [
      proposal(1),
      proposal(2, { symbol: "AAA", rankingConfidence: 0.7 }),
      proposal(3, {
        proposalType: "IMPROVE_DECISION_TIMING",
        targetArea: "wait_timing",
        rankingConfidence: 0.6,
        blockingFlags: ["stale_source"],
      }),
    ],
  }, {
    now: "2026-07-16T19:00:00.000Z",
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.sourceProposalCount, 3);
  assert.equal(report.analyzedProposalCount, 3);
  assert.equal(report.proposalTypeGroupCount, 2);
  assert.equal(report.targetAreaGroupCount, 2);
  assert.equal(report.byProposalType[0].sampleCount, 2);
  assert.equal(report.byProposalType[0].uniqueSymbolCount, 2);
  assert.equal(report.byProposalType[0].blockingFlagCounts.wide_spread, 2);
});

test("marks high-confidence disagreement groups for calibration review", () => {
  const proposals = Array.from({ length: 10 }, (_, index) =>
    proposal(index + 1, { rankingConfidence: index < 7 ? 0.8 : 0.6 }));

  const report = buildProposalEvidenceAggregationCalibrationReview({
    proposalCount: proposals.length,
    proposals,
  });

  const group = report.byProposalType[0];
  assert.equal(group.sampleCount, 10);
  assert.equal(group.highConfidenceConcernCount, 7);
  assert.equal(group.disagreementRatePct, 70);
  assert.equal(group.calibrationBand, "EARLY_SAMPLE");
  assert.equal(group.calibrationReviewStatus, "HIGH_CALIBRATION_CONCERN");
  assert.ok(report.calibrationReviewQueueCount >= 1);
});

test("keeps calibration review read only with every mutation lock closed", () => {
  const report = buildProposalEvidenceAggregationCalibrationReview({
    proposals: [proposal(1)],
  });

  assert.equal(report.readOnly, true);
  assert.equal(report.proposalOnly, true);
  assert.equal(report.humanReviewRequired, true);
  assert.equal(report.separateApprovalRequired, true);
  assert.equal(report.automaticLearningAllowed, false);
  assert.equal(report.automaticPatchAllowed, false);
  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
  assert.equal(report.byProposalType[0].calibrationReviewStatus, "INSUFFICIENT_EVIDENCE");
});
