import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildProposalCalibrationHistoryRecord,
  persistProposalCalibrationHistory,
  readProposalCalibrationHistory,
} from "../src/scanner/proposal_calibration_history_store.mjs";

function fixture() {
  return {
    proposalReport: {
      version: "decision_quality_proposal_generation_v1",
      proposalCount: 100,
    },
    calibrationReview: {
      version: "proposal_evidence_aggregation_calibration_review_v1",
      analyzedProposalCount: 100,
      proposalTypeGroupCount: 2,
      targetAreaGroupCount: 2,
      calibrationReviewQueueCount: 1,
      calibrationReviewQueue: [{
        groupDimension: "proposal_type",
        groupKey: "tighten_threshold",
        proposalCount: 12,
        uniqueSymbolCount: 8,
        uniqueScanCount: 10,
        sampleBand: "developing",
        reviewStatus: "calibration_review",
        disagreementRate: 0.25,
        averageRankingConfidence: 0.82,
        averageLatestReturnPct: -1.4,
        highConfidenceConcernCount: 3,
      }],
    },
  };
}

test("builds bounded immutable proposal calibration history record", () => {
  const { proposalReport, calibrationReview } = fixture();
  const record = buildProposalCalibrationHistoryRecord(
    proposalReport,
    calibrationReview,
    { now: new Date("2026-07-16T20:00:00.000Z") },
  );

  assert.equal(record.version, "proposal_calibration_history_store_v1");
  assert.equal(record.generatedAt, "2026-07-16T20:00:00.000Z");
  assert.equal(record.proposalCount, 100);
  assert.equal(record.groups.length, 1);
  assert.equal(record.groups[0].groupKey, "tighten_threshold");
  assert.equal(record.automaticLearningAllowed, false);
  assert.equal(record.scannerLogicMutationAllowed, false);
  assert.equal(record.localJsonlOnly, true);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.groups), true);
});

test("persists private local jsonl history and reads newest first", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "proposal-calibration-history-"));
  const historyPath = path.join(dir, "history.jsonl");
  const { proposalReport, calibrationReview } = fixture();

  persistProposalCalibrationHistory(proposalReport, calibrationReview, {
    historyPath,
    now: new Date("2026-07-16T20:00:00.000Z"),
  });
  persistProposalCalibrationHistory(proposalReport, {
    ...calibrationReview,
    analyzedProposalCount: 101,
  }, {
    historyPath,
    now: new Date("2026-07-16T21:00:00.000Z"),
  });

  const history = readProposalCalibrationHistory({ historyPath, maxRecords: 10 });
  assert.equal(history.recordCount, 2);
  assert.equal(history.records[0].analyzedProposalCount, 101);
  assert.equal(history.records[1].analyzedProposalCount, 100);
  assert.equal(history.automaticLearningAllowed, false);
  assert.equal(history.scannerLogicMutationAllowed, false);
  assert.equal(fs.statSync(historyPath).mode & 0o777, 0o600);
});

test("skips consecutive duplicate calibration snapshots", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "proposal-calibration-dedupe-"));
  const historyPath = path.join(dir, "history.jsonl");
  const { proposalReport, calibrationReview } = fixture();

  const first = persistProposalCalibrationHistory(proposalReport, calibrationReview, {
    historyPath,
    now: new Date("2026-07-16T20:00:00.000Z"),
  });
  const second = persistProposalCalibrationHistory(proposalReport, calibrationReview, {
    historyPath,
    now: new Date("2026-07-16T21:00:00.000Z"),
  });

  assert.equal(first.appendResult.appended, true);
  assert.equal(second.appendResult.appended, false);
  assert.equal(second.appendResult.duplicateSkipped, true);
  assert.equal(
    fs.readFileSync(historyPath, "utf8").split(/\r?\n/).filter(Boolean).length,
    1,
  );
});

test("returns immutable empty history when file is missing", () => {
  const history = readProposalCalibrationHistory({
    historyPath: path.join(os.tmpdir(), `missing-${Date.now()}.jsonl`),
  });

  assert.equal(history.recordCount, 0);
  assert.deepEqual(history.records, []);
  assert.equal(history.localJsonlOnly, true);
  assert.equal(Object.isFrozen(history.records), true);
});
