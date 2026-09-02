import crypto from "node:crypto";

import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";
import { evaluateAiLogicCandidateDiff } from "./ai_logic_candidate_diff_allowlist.mjs";
import { evaluateAiLogicCandidateSemanticGuard } from "./ai_logic_candidate_semantic_guard.mjs";

export const VERSION = "ai_logic_offline_candidate_replay_v2";

export const ALLOWED_REPLAY_TOPICS = Object.freeze([
  "evidence_interpretation",
  "false_positive_classification_logic",
  "missed_opportunity_classification_logic",
  "decision_timing_logic_without_threshold_mutation",
  "classification_coverage",
]);

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableClone(value[key])]),
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableClone(value));
}

function hashValue(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeSamples(samples) {
  if (!Array.isArray(samples)) return [];
  return samples.map((sample, index) =>
    Object.freeze({
      sampleId: String(sample?.sampleId ?? `sample-${index + 1}`).trim(),
      input: stableClone(sample?.input ?? null),
      expected: stableClone(sample?.expected ?? null),
    }),
  );
}

function evaluateDeterministically(evaluator, input, role) {
  const firstInput = stableClone(input);
  const firstBefore = stableStringify(firstInput);
  let firstOutput;
  try {
    firstOutput = stableClone(evaluator(firstInput));
  } catch {
    return { ok: false, reason: `${role}_EVALUATOR_ERROR` };
  }
  if (stableStringify(firstInput) !== firstBefore) {
    return { ok: false, reason: `${role}_INPUT_MUTATION` };
  }

  const secondInput = stableClone(input);
  const secondBefore = stableStringify(secondInput);
  let secondOutput;
  try {
    secondOutput = stableClone(evaluator(secondInput));
  } catch {
    return { ok: false, reason: `${role}_EVALUATOR_ERROR` };
  }
  if (stableStringify(secondInput) !== secondBefore) {
    return { ok: false, reason: `${role}_INPUT_MUTATION` };
  }

  if (stableStringify(firstOutput) !== stableStringify(secondOutput)) {
    return { ok: false, reason: `${role}_NONDETERMINISTIC` };
  }

  return { ok: true, output: firstOutput };
}

function buildBlockedResult({ candidateId, topic, manifest, samples, reasons }) {
  return Object.freeze({
    version: VERSION,
    candidateId,
    topic,
    eligible: false,
    status: "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_REJECT",
    disposition: "REJECT_OR_HOLD",
    reasons: Object.freeze([...new Set(reasons)].sort()),
    immutableManifestStatus: manifest.status,
    sampleCount: samples.length,
    replayId: null,
    baselineHash: null,
    candidateHash: null,
    baselineMetrics: null,
    candidateMetrics: null,
    comparisons: Object.freeze([]),
    productionRuntimeWiringAllowed: false,
    persistenceAllowed: false,
    promotionAllowed: false,
    rollbackExecutionAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
    immutablePolicyMutationAllowed: false,
    thresholdMutationAllowed: false,
    sizingMutationAllowed: false,
    allocationMutationAllowed: false,
  });
}

export function runAiLogicOfflineCandidateReplay(input = {}) {
  const topic = String(input.topic ?? "").trim();
  const candidateId = String(input.candidateId ?? "").trim();
  const baselineEvaluator = input.baselineEvaluator;
  const candidateEvaluator = input.candidateEvaluator;
  const samples = normalizeSamples(input.samples);
  const reasons = [];
  const manifest = verifyImmutablePolicyManifest();

  if (!manifest.ok) reasons.push("IMMUTABLE_MANIFEST_NOT_VERIFIED");
  if (!ALLOWED_REPLAY_TOPICS.includes(topic)) reasons.push("TOPIC_NOT_ALLOWLISTED");
  if (!candidateId) reasons.push("CANDIDATE_ID_REQUIRED");
  if (!samples.length) reasons.push("REPLAY_SAMPLES_REQUIRED");
  if (typeof baselineEvaluator !== "function") reasons.push("BASELINE_EVALUATOR_REQUIRED");
  if (typeof candidateEvaluator !== "function") reasons.push("CANDIDATE_EVALUATOR_REQUIRED");

  const diff = evaluateAiLogicCandidateDiff({
    topic,
    changedPaths: input.changedPaths,
  });
  if (!diff.eligible) {
    reasons.push(...diff.reasons.map((reason) => `DIFF:${reason}`));
  }

  const semantic = evaluateAiLogicCandidateSemanticGuard({
    mutationIntents: input.mutationIntents,
    sourceText: input.sourceText,
  });
  if (!semantic.eligible) {
    reasons.push(...semantic.reasons.map((reason) => `SEMANTIC:${reason}`));
  }

  if (reasons.length) {
    return buildBlockedResult({ candidateId, topic, manifest, samples, reasons });
  }

  const comparisons = [];
  for (const sample of samples) {
    const baselineEvaluation = evaluateDeterministically(
      baselineEvaluator,
      sample.input,
      "BASELINE",
    );
    if (!baselineEvaluation.ok) {
      return buildBlockedResult({
        candidateId,
        topic,
        manifest,
        samples,
        reasons: [baselineEvaluation.reason],
      });
    }

    const candidateEvaluation = evaluateDeterministically(
      candidateEvaluator,
      sample.input,
      "CANDIDATE",
    );
    if (!candidateEvaluation.ok) {
      return buildBlockedResult({
        candidateId,
        topic,
        manifest,
        samples,
        reasons: [candidateEvaluation.reason],
      });
    }

    const baseline = baselineEvaluation.output;
    const candidate = candidateEvaluation.output;
    comparisons.push(Object.freeze({
      sampleId: sample.sampleId,
      expected: sample.expected,
      baseline,
      candidate,
      baselineMatchesExpected:
        stableStringify(baseline) === stableStringify(sample.expected),
      candidateMatchesExpected:
        stableStringify(candidate) === stableStringify(sample.expected),
      changed: stableStringify(baseline) !== stableStringify(candidate),
    }));
  }

  const baselineCorrect = comparisons.filter((row) => row.baselineMatchesExpected).length;
  const candidateCorrect = comparisons.filter((row) => row.candidateMatchesExpected).length;
  const changedCount = comparisons.filter((row) => row.changed).length;

  const baselineMetrics = Object.freeze({
    sampleCount: comparisons.length,
    correctCount: baselineCorrect,
    accuracy: baselineCorrect / comparisons.length,
  });

  const candidateMetrics = Object.freeze({
    sampleCount: comparisons.length,
    correctCount: candidateCorrect,
    accuracy: candidateCorrect / comparisons.length,
    changedCount,
    accuracyDelta: (candidateCorrect - baselineCorrect) / comparisons.length,
  });

  const baselineHash = hashValue(
    comparisons.map(({ sampleId, baseline }) => ({ sampleId, output: baseline })),
  );
  const candidateHash = hashValue(
    comparisons.map(({ sampleId, candidate }) => ({ sampleId, output: candidate })),
  );
  const replayId = hashValue({
    version: VERSION,
    candidateId,
    topic,
    sampleIds: comparisons.map((row) => row.sampleId),
    baselineHash,
    candidateHash,
  });

  return Object.freeze({
    version: VERSION,
    candidateId,
    topic,
    eligible: true,
    status: "AI_LOGIC_OFFLINE_CANDIDATE_REPLAY_COMPLETE",
    disposition: "OFFLINE_EVIDENCE_ONLY",
    reasons: Object.freeze([]),
    immutableManifestStatus: manifest.status,
    sampleCount: comparisons.length,
    replayId,
    baselineHash,
    candidateHash,
    baselineMetrics,
    candidateMetrics,
    comparisons: Object.freeze(comparisons),
    productionRuntimeWiringAllowed: false,
    persistenceAllowed: false,
    promotionAllowed: false,
    rollbackExecutionAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
    immutablePolicyMutationAllowed: false,
    thresholdMutationAllowed: false,
    sizingMutationAllowed: false,
    allocationMutationAllowed: false,
  });
}

export default Object.freeze({
  VERSION,
  ALLOWED_REPLAY_TOPICS,
  runAiLogicOfflineCandidateReplay,
});
