import fs from "node:fs";
import path from "node:path";

export const DEFAULT_PROPOSAL_CALIBRATION_HISTORY_PATH =
  path.resolve("runs/proposal_calibration_history.jsonl");

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : fallback;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeGroup(group = {}) {
  return Object.freeze({
    groupDimension: safeText(group.groupDimension, "unknown"),
    groupKey: safeText(group.groupKey, "unknown"),
    proposalCount: boundedInteger(group.proposalCount, 0, 0, 1000000),
    uniqueSymbolCount: boundedInteger(group.uniqueSymbolCount, 0, 0, 1000000),
    uniqueScanCount: boundedInteger(group.uniqueScanCount, 0, 0, 1000000),
    sampleBand: safeText(group.sampleBand, "insufficient"),
    reviewStatus: safeText(group.reviewStatus, "observe_only"),
    disagreementRate: finiteOrNull(group.disagreementRate),
    averageRankingConfidence: finiteOrNull(group.averageRankingConfidence),
    averageLatestReturnPct: finiteOrNull(group.averageLatestReturnPct),
    highConfidenceConcernCount: boundedInteger(group.highConfidenceConcernCount, 0, 0, 1000000),
  });
}

export function buildProposalCalibrationHistoryRecord(
  proposalReport = {},
  calibrationReview = {},
  options = {},
) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const generatedAt = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const queue = Array.isArray(calibrationReview.calibrationReviewQueue)
    ? calibrationReview.calibrationReviewQueue
    : [];
  const maxGroups = boundedInteger(options.maxGroups, 100, 1, 200);

  return Object.freeze({
    version: "proposal_calibration_history_store_v1",
    generatedAt,
    proposalVersion: safeText(proposalReport.version, "unknown"),
    calibrationVersion: safeText(calibrationReview.version, "unknown"),
    proposalCount: boundedInteger(proposalReport.proposalCount, 0, 0, 1000000),
    analyzedProposalCount: boundedInteger(calibrationReview.analyzedProposalCount, 0, 0, 1000000),
    proposalTypeGroupCount: boundedInteger(calibrationReview.proposalTypeGroupCount, 0, 0, 1000000),
    targetAreaGroupCount: boundedInteger(calibrationReview.targetAreaGroupCount, 0, 0, 1000000),
    calibrationReviewQueueCount: boundedInteger(
      calibrationReview.calibrationReviewQueueCount,
      queue.length,
      0,
      1000000,
    ),
    groups: Object.freeze(queue.slice(0, maxGroups).map(normalizeGroup)),
    automaticLearningAllowed: false,
    automaticPatchAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    localJsonlOnly: true,
  });
}

export function appendProposalCalibrationHistoryRecord(record, options = {}) {
  const historyPath = path.resolve(
    options.historyPath ?? DEFAULT_PROPOSAL_CALIBRATION_HISTORY_PATH,
  );
  fs.mkdirSync(path.dirname(historyPath), { recursive: true, mode: 0o700 });

  const fingerprint = JSON.stringify({
    proposalVersion: record?.proposalVersion ?? null,
    calibrationVersion: record?.calibrationVersion ?? null,
    proposalCount: record?.proposalCount ?? 0,
    analyzedProposalCount: record?.analyzedProposalCount ?? 0,
    proposalTypeGroupCount: record?.proposalTypeGroupCount ?? 0,
    targetAreaGroupCount: record?.targetAreaGroupCount ?? 0,
    calibrationReviewQueueCount: record?.calibrationReviewQueueCount ?? 0,
    groups: Array.isArray(record?.groups) ? record.groups : [],
  });

  let latestFingerprint = null;
  if (fs.existsSync(historyPath)) {
    const lines = fs.readFileSync(historyPath, "utf8").split(/\r?\n/).filter(Boolean);
    const latestLine = lines.at(-1);
    if (latestLine) {
      try {
        const latest = JSON.parse(latestLine);
        latestFingerprint = JSON.stringify({
          proposalVersion: latest?.proposalVersion ?? null,
          calibrationVersion: latest?.calibrationVersion ?? null,
          proposalCount: latest?.proposalCount ?? 0,
          analyzedProposalCount: latest?.analyzedProposalCount ?? 0,
          proposalTypeGroupCount: latest?.proposalTypeGroupCount ?? 0,
          targetAreaGroupCount: latest?.targetAreaGroupCount ?? 0,
          calibrationReviewQueueCount: latest?.calibrationReviewQueueCount ?? 0,
          groups: Array.isArray(latest?.groups) ? latest.groups : [],
        });
      } catch {
      }
    }
  }

  if (latestFingerprint === fingerprint) {
    return Object.freeze({
      appended: false,
      duplicateSkipped: true,
      historyPath,
      localJsonlOnly: true,
      automaticLearningAllowed: false,
      scannerLogicMutationAllowed: false,
    });
  }

  fs.appendFileSync(historyPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(historyPath, 0o600);
  } catch {
  }
  return Object.freeze({
    appended: true,
    duplicateSkipped: false,
    historyPath,
    localJsonlOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
  });
}

export function readProposalCalibrationHistory(options = {}) {
  const historyPath = path.resolve(
    options.historyPath ?? DEFAULT_PROPOSAL_CALIBRATION_HISTORY_PATH,
  );
  const maxRecords = boundedInteger(options.maxRecords, 100, 1, 1000);

  if (!fs.existsSync(historyPath)) {
    return Object.freeze({
      version: "proposal_calibration_history_reader_v1",
      historyPath,
      recordCount: 0,
      records: Object.freeze([]),
      localJsonlOnly: true,
      automaticLearningAllowed: false,
      scannerLogicMutationAllowed: false,
    });
  }

  const records = fs
    .readFileSync(historyPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(-maxRecords)
    .reverse()
    .map((record) => Object.freeze(record));

  return Object.freeze({
    version: "proposal_calibration_history_reader_v1",
    historyPath,
    recordCount: records.length,
    records: Object.freeze(records),
    localJsonlOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
  });
}

export function persistProposalCalibrationHistory(
  proposalReport = {},
  calibrationReview = {},
  options = {},
) {
  const record = buildProposalCalibrationHistoryRecord(
    proposalReport,
    calibrationReview,
    options,
  );
  const appendResult = appendProposalCalibrationHistoryRecord(record, options);
  return Object.freeze({
    record,
    appendResult,
  });
}
