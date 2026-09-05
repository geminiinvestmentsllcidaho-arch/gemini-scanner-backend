import { executeAiLogicAtomicApply } from "./ai_logic_atomic_apply_executor.mjs";

export const VERSION = "ai_logic_local_integration_execution_seam_v1";

const LOCKS = Object.freeze([
  "runtimeActivationAllowed","pm2RestartAllowed","productionRuntimeWiringAllowed",
  "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed",
  "orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
  "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
  "allocationMutationAllowed","gitMutationAllowed","gitCheckoutAllowed","gitResetAllowed",
  "gitRevertAllowed","gitMergeAllowed","gitCherryPickAllowed",
]);

const present = (v) => typeof v === "string" && v.trim().length > 0;
const allowedTarget = (v) => {
  const s = String(v ?? "").trim().replaceAll("\\", "/");
  return !!s && !s.startsWith("/") && !s.split("/").includes("..")
    && s.replace(/^\.\//, "").replace(/\/+/g, "/").startsWith("src/scanner/ai_logic_candidates/");
};

export function executeAiLogicLocalIntegrationSeam({
  orchestratorContract:o,
  atomicExecutorInput:e,
  atomicExecutor=executeAiLogicAtomicApply,
} = {}) {
  const reasons = [];
  if (
    o?.version !== "ai_logic_local_integration_orchestrator_contract_v1"
    || o?.eligible !== true
    || o?.localCandidateSourceApplySeamReady !== true
    || o?.status !== "AI_LOGIC_LOCAL_INTEGRATION_ORCHESTRATOR_READY"
    || o?.disposition !== "EXPLICIT_LOCAL_CANDIDATE_SOURCE_APPLY_SEAM_ONLY"
    || o?.localCandidateFilesystemMutationScope !== "ALLOWLISTED_AI_LOGIC_CANDIDATE_SOURCE_ONLY"
  ) reasons.push("ORCHESTRATOR_CONTRACT_NOT_READY");

  for (const f of ["approvalRecordId","nonce","action","decisionRecordId","candidateSourceHash","currentSourceCommit","targetSourceCommit"]) {
    if (!present(o?.[f])) reasons.push(`ORCHESTRATOR_IDENTITY_MISSING_${f}`);
  }
  if (!["PROMOTION","ROLLBACK"].includes(o?.action)) reasons.push("ORCHESTRATOR_ACTION_INVALID");
  for (const f of LOCKS) if (o?.[f] !== false) reasons.push(`ORCHESTRATOR_${f}_MUST_BE_FALSE`);

  const b = e?.boundaryEvidence;
  if (
    b?.version !== "ai_logic_execution_boundary_gate_v1"
    || b?.eligible !== true
    || b?.applyEligibilityOnly !== true
    || b?.readOnly !== true
    || b?.evidenceOnly !== true
    || b?.paperOnly !== true
  ) reasons.push("BOUNDARY_EVIDENCE_INVALID");

  for (const f of ["approvalRecordId","nonce","action","decisionRecordId","candidateSourceHash","currentSourceCommit","targetSourceCommit"]) {
    if (b?.[f] !== o?.[f]) reasons.push(`BOUNDARY_ORCHESTRATOR_BINDING_MISMATCH_${f}`);
  }
  if (!allowedTarget(e?.targetPath)) reasons.push("TARGET_PATH_NOT_ALLOWLISTED");
  if (typeof atomicExecutor !== "function") reasons.push("ATOMIC_EXECUTOR_INVALID");

  if (reasons.length) {
    return Object.freeze({
      version: VERSION,
      executed: false,
      applied: false,
      status: "LOCAL_INTEGRATION_EXECUTION_SEAM_BLOCKED",
      reasons: Object.freeze(reasons),
      runtimeActivated: false,
      pm2RestartPerformed: false,
      gitMutationPerformed: false,
      brokerOrderAccountEffects: "NONE",
      liveTradingAuthority: "NONE",
      immutablePolicyMutationAuthority: "NONE",
      ...Object.fromEntries(LOCKS.map((f) => [f, false])),
    });
  }

  const result = atomicExecutor(e);
  return Object.freeze({
    version: VERSION,
    executed: true,
    ...result,
    runtimeActivated: false,
    pm2RestartPerformed: false,
    gitMutationPerformed: false,
    brokerOrderAccountEffects: "NONE",
    liveTradingAuthority: "NONE",
    immutablePolicyMutationAuthority: "NONE",
    ...Object.fromEntries(LOCKS.map((f) => [f, false])),
  });
}

export default Object.freeze({ VERSION, executeAiLogicLocalIntegrationSeam });
