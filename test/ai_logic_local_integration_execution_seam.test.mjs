import test from "node:test";
import assert from "node:assert/strict";
import { executeAiLogicLocalIntegrationSeam as run } from "../src/scanner/ai_logic_local_integration_execution_seam.mjs";

const locks = {
  runtimeActivationAllowed:false,
  pm2RestartAllowed:false,
  productionRuntimeWiringAllowed:false,
  promotionExecutionAllowed:false,
  rollbackExecutionAllowed:false,
  brokerContactAllowed:false,
  orderPlacementAllowed:false,
  liveTradingAllowed:false,
  accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,
  sizingMutationAllowed:false,
  allocationMutationAllowed:false,
  gitMutationAllowed:false,
  gitCheckoutAllowed:false,
  gitResetAllowed:false,
  gitRevertAllowed:false,
  gitMergeAllowed:false,
  gitCherryPickAllowed:false,
};

function fixture() {
  const identity = {
    approvalRecordId:"a",
    nonce:"n",
    action:"PROMOTION",
    decisionRecordId:"d",
    candidateSourceHash:"c".repeat(64),
    currentSourceCommit:"before",
    targetSourceCommit:"after",
  };
  const orchestratorContract = {
    version:"ai_logic_local_integration_orchestrator_contract_v1",
    eligible:true,
    status:"AI_LOGIC_LOCAL_INTEGRATION_ORCHESTRATOR_READY",
    disposition:"EXPLICIT_LOCAL_CANDIDATE_SOURCE_APPLY_SEAM_ONLY",
    localCandidateSourceApplySeamReady:true,
    localCandidateFilesystemMutationScope:"ALLOWLISTED_AI_LOGIC_CANDIDATE_SOURCE_ONLY",
    ...identity,
    ...locks,
  };
  const boundaryEvidence = {
    version:"ai_logic_execution_boundary_gate_v1",
    eligible:true,
    applyEligibilityOnly:true,
    readOnly:true,
    evidenceOnly:true,
    paperOnly:true,
    ...identity,
    productionRuntimeWiringAllowed:false,
    promotionExecutionAllowed:false,
    rollbackExecutionAllowed:false,
    brokerContactAllowed:false,
    orderPlacementAllowed:false,
    liveTradingAllowed:false,
    accountMutationAllowed:false,
    immutablePolicyMutationAllowed:false,
    thresholdMutationAllowed:false,
    sizingMutationAllowed:false,
    allocationMutationAllowed:false,
    gitMutationAllowed:false,
  };
  return {
    orchestratorContract,
    atomicExecutorInput:{
      boundaryEvidence,
      targetPath:"src/scanner/ai_logic_candidates/x.mjs",
    },
  };
}

test("ready contract calls atomic executor exactly once with original input", () => {
  const f = fixture();
  let calls = 0;
  let seen = null;
  const result = run({
    ...f,
    atomicExecutor(input) {
      calls += 1;
      seen = input;
      return {
        applied:true,
        rolledBack:false,
        status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",
        runtimeActivated:false,
        pm2RestartPerformed:false,
        gitMutationPerformed:false,
        brokerOrderAccountEffects:"NONE",
        liveTradingAuthority:"NONE",
        immutablePolicyMutationAuthority:"NONE",
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(seen, f.atomicExecutorInput);
  assert.equal(result.executed, true);
  assert.equal(result.applied, true);
  assert.equal(result.status, "LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED");
  assert.equal(result.runtimeActivated, false);
  assert.equal(result.pm2RestartPerformed, false);
  assert.equal(result.gitMutationPerformed, false);
  assert.equal(result.brokerOrderAccountEffects, "NONE");
});

test("unready orchestrator fails closed before atomic executor", () => {
  const f = fixture();
  f.orchestratorContract = {
    ...f.orchestratorContract,
    eligible:false,
    localCandidateSourceApplySeamReady:false,
  };
  let calls = 0;
  const result = run({
    ...f,
    atomicExecutor() {
      calls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.executed, false);
  assert.equal(result.applied, false);
});

test("identity or target drift fails closed before atomic executor", () => {
  for (const mutate of [
    f => { f.atomicExecutorInput = {...f.atomicExecutorInput, boundaryEvidence:{...f.atomicExecutorInput.boundaryEvidence, nonce:"other"}}; },
    f => { f.atomicExecutorInput = {...f.atomicExecutorInput, targetPath:"src/scanner/not-allowed.mjs"}; },
  ]) {
    const f = fixture();
    mutate(f);
    let calls = 0;
    const result = run({
      ...f,
      atomicExecutor() {
        calls += 1;
        return {applied:true};
      },
    });
    assert.equal(calls, 0);
    assert.equal(result.executed, false);
    assert.equal(result.applied, false);
  }
});

test("seam never grants runtime git broker account live or immutable-policy authority", () => {
  const f = fixture();
  const result = run({
    ...f,
    atomicExecutor:() => ({
      applied:false,
      rolledBack:false,
      status:"ATOMIC_APPLY_BLOCKED_PRECONDITION",
      runtimeActivated:false,
      pm2RestartPerformed:false,
      gitMutationPerformed:false,
      brokerOrderAccountEffects:"NONE",
      liveTradingAuthority:"NONE",
      immutablePolicyMutationAuthority:"NONE",
    }),
  });
  for (const field of Object.keys(locks)) {
    assert.equal(result[field], false, field);
  }
});
