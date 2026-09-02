import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";
import { evaluateOfflineExperimentEligibility } from "./ai_logic_offline_experiment_contract.mjs";
import { evaluateAiLogicCandidateDiff } from "./ai_logic_candidate_diff_allowlist.mjs";
import { evaluateAiLogicCandidateSemanticGuard } from "./ai_logic_candidate_semantic_guard.mjs";
import { runAiLogicOfflineCandidateReplay } from "./ai_logic_offline_candidate_replay.mjs";

export const VERSION = "ai_logic_candidate_safety_gate_v1";

const LOCKS = Object.freeze({
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

const freezeReasons = (values) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort());

export function evaluateAiLogicCandidateSafetyGate(input = {}, options = {}) {
  const candidateId = String(input.candidateId ?? "").trim();
  const topic = String(input.topic ?? "").trim();

  const manifest = options.manifestResult ?? verifyImmutablePolicyManifest();

  const experiment = evaluateOfflineExperimentEligibility(
    {
      candidateId,
      topic,
      explicitFixtureOrInMemoryOnly: input.explicitFixtureOrInMemoryOnly === true,
      requestsExistingSourceMutation: input.requestsExistingSourceMutation === true,
      requestsProductionWiring: input.requestsProductionWiring === true,
      requestsLedgerWrite: input.requestsLedgerWrite === true,
    },
    { manifestResult: manifest },
  );

  const diff = evaluateAiLogicCandidateDiff({
    topic,
    changedPaths: input.changedPaths,
  });

  const semantic = evaluateAiLogicCandidateSemanticGuard({
    mutationIntents: input.mutationIntents,
    sourceText: input.sourceText,
  });

  const replay = runAiLogicOfflineCandidateReplay({
    candidateId,
    topic,
    changedPaths: input.changedPaths,
    mutationIntents: input.mutationIntents,
    sourceText: input.sourceText,
    samples: input.samples,
    baselineEvaluator: input.baselineEvaluator,
    candidateEvaluator: input.candidateEvaluator,
  });

  const reasons = [];
  if (manifest.ok !== true) reasons.push(`IMMUTABLE:${manifest.status ?? "REJECT"}`);
  if (experiment.eligible !== true) {
    reasons.push(...(experiment.blockers ?? []).map((x) => `EXPERIMENT:${x}`));
  }
  if (diff.eligible !== true) {
    reasons.push(...(diff.reasons ?? []).map((x) => `DIFF:${x}`));
  }
  if (semantic.eligible !== true) {
    reasons.push(...(semantic.reasons ?? []).map((x) => `SEMANTIC:${x}`));
  }
  if (replay.eligible !== true) {
    reasons.push(...(replay.reasons ?? []).map((x) => `REPLAY:${x}`));
  }

  const eligible =
    manifest.ok === true &&
    experiment.eligible === true &&
    diff.eligible === true &&
    semantic.eligible === true &&
    replay.eligible === true;

  return Object.freeze({
    version: VERSION,
    candidateId: candidateId || null,
    topic: topic || null,
    eligible,
    status: eligible
      ? "AI_LOGIC_CANDIDATE_SAFETY_GATE_ELIGIBLE_FOR_OFFLINE_EVIDENCE_ONLY"
      : "AI_LOGIC_CANDIDATE_SAFETY_GATE_REJECT",
    disposition: eligible ? "OFFLINE_EVIDENCE_ONLY" : "REJECT_OR_HOLD",
    reasons: freezeReasons(reasons),
    gates: Object.freeze({
      immutableManifest: manifest.status ?? null,
      offlineExperiment: experiment.status ?? null,
      candidateDiff: diff.status ?? null,
      semanticGuard: semantic.status ?? null,
      offlineReplay: replay.status ?? null,
    }),
    replay: Object.freeze({
      sampleCount: replay.sampleCount ?? 0,
      baselineMetrics: replay.baselineMetrics ?? null,
      candidateMetrics: replay.candidateMetrics ?? null,
      replayId: replay.replayId ?? null,
      baselineHash: replay.baselineHash ?? null,
      candidateHash: replay.candidateHash ?? null,
    }),
    ...LOCKS,
  });
}

export default Object.freeze({
  VERSION,
  evaluateAiLogicCandidateSafetyGate,
});
