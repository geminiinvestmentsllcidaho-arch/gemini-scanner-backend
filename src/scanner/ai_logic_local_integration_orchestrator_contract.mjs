export const VERSION="ai_logic_local_integration_orchestrator_contract_v1";
const LOCKS=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];
const present=v=>typeof v==="string"&&v.trim().length>0;
export function buildAiLogicLocalIntegrationOrchestratorContract({
  operatorApproval:a,decisionEvidence:d,consumptionStoreRecord:c,
  authorityGate:g,boundaryGate:b,immutableManifest:m,
  currentSourceCommit,targetSourceCommit,
}={}){
  const reasons=[];
  if(a?.version!=="ai_logic_operator_approval_record_v1"||a?.valid!==true||a?.explicitlyApproved!==true||a?.oneShot!==true) reasons.push("OPERATOR_APPROVAL_INVALID");
  if(!d||d?.recordId!==a?.decisionRecordId) reasons.push("DECISION_EVIDENCE_INVALID");
  for(const f of ["candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"]) {
    if(!present(a?.[f])||d?.[f]!==a[f]) reasons.push(`DECISION_IDENTITY_MISMATCH_${f}`);
  }
  if(a?.acceptanceRecordId!=null&&d?.acceptanceRecordId!==a.acceptanceRecordId) reasons.push("DECISION_IDENTITY_MISMATCH_acceptanceRecordId");
  if(c?.version!=="ai_logic_operator_approval_consumption_store_v1"||c?.exactlyOnce!==true||c?.paperOnly!==true) reasons.push("CONSUMPTION_INVALID");
  if(g?.version!=="ai_logic_execution_authority_gate_v1"||g?.eligible!==true||g?.readOnly!==true||g?.evidenceOnly!==true||g?.paperOnly!==true) reasons.push("AUTHORITY_GATE_INVALID");
  if(b?.version!=="ai_logic_execution_boundary_gate_v1"||b?.eligible!==true||b?.applyEligibilityOnly!==true||b?.readOnly!==true||b?.evidenceOnly!==true||b?.paperOnly!==true) reasons.push("BOUNDARY_GATE_INVALID");
  if(m?.ok!==true||m?.status!=="IMMUTABLE_MANIFEST_VERIFIED") reasons.push("IMMUTABLE_MANIFEST_INVALID");
  const action=a?.action;
  if(!["PROMOTION","ROLLBACK"].includes(action)) reasons.push("ACTION_INVALID");
  const expectedCurrent=action==="PROMOTION"?a?.sourceCommitBefore:a?.sourceCommitAfter;
  const expectedTarget=action==="PROMOTION"?a?.sourceCommitAfter:a?.sourceCommitBefore;
  if(currentSourceCommit!==expectedCurrent) reasons.push("CURRENT_SOURCE_COMMIT_DRIFT");
  if(targetSourceCommit!==expectedTarget) reasons.push("TARGET_SOURCE_COMMIT_DRIFT");
  const identity={
    approvalRecordId:a?.recordId,
    nonce:a?.nonce,
    action,
    decisionRecordId:a?.decisionRecordId,
    candidateSourceHash:a?.candidateSourceHash,
    currentSourceCommit,
    targetSourceCommit,
  };
  for(const [k,v] of Object.entries(identity)){
    if(!present(v)||c?.[k]!==v||g?.[k]!==v||b?.[k]!==v) reasons.push(`CHAIN_BINDING_MISMATCH_${k}`);
  }
  for(const q of [a,c,g,b]) for(const k of LOCKS) if(q?.[k]!==false) reasons.push(`${k}_MUST_BE_FALSE`);
  const eligible=reasons.length===0;
  return Object.freeze({
    version:VERSION,
    eligible,
    status:eligible?"AI_LOGIC_LOCAL_INTEGRATION_ORCHESTRATOR_READY":"AI_LOGIC_LOCAL_INTEGRATION_ORCHESTRATOR_HOLD",
    disposition:eligible?"EXPLICIT_LOCAL_CANDIDATE_SOURCE_APPLY_SEAM_ONLY":"LOCAL_INTEGRATION_BLOCKED",
    reasons:Object.freeze(reasons),
    ...identity,
    localCandidateSourceApplySeamReady:eligible,
    localCandidateFilesystemMutationScope:eligible?"ALLOWLISTED_AI_LOGIC_CANDIDATE_SOURCE_ONLY":"NONE",
    runtimeActivationAllowed:false,
    pm2RestartAllowed:false,
    gitCheckoutAllowed:false,
    gitResetAllowed:false,
    gitRevertAllowed:false,
    gitMergeAllowed:false,
    gitCherryPickAllowed:false,
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
  });
}
export default Object.freeze({VERSION,buildAiLogicLocalIntegrationOrchestratorContract});
