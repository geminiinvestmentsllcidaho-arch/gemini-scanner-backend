import { resolveAiLogicPersistedApprovalAndDecision } from "./ai_logic_local_persisted_evidence_resolvers.mjs";
import { readAiLogicKnownGoodRecordById } from "./ai_logic_known_good_record_store.mjs";
import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";
import { buildAiLogicRollbackExecutionAuthorityContract } from "./ai_logic_rollback_execution_authority_contract.mjs";

export const VERSION="ai_logic_persisted_rollback_authority_adapter_v1";
const present=v=>typeof v==="string"&&v.trim().length>0;
const CLOSED=Object.freeze({readOnly:true,localJsonlOnly:true,approvalConsumptionAllowed:false,productionRuntimeWiringAllowed:false,persistenceAllowed:false,promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false,gitCheckoutAllowed:false,gitResetAllowed:false,gitRevertAllowed:false});
const fail=(reasons,a={})=>Object.freeze({version:VERSION,eligible:false,status:"AI_LOGIC_PERSISTED_ROLLBACK_AUTHORITY_ADAPTER_HOLD",disposition:"ROLLBACK_AUTHORITY_BLOCKED",reasons:Object.freeze([...new Set(reasons)].sort()),approvalRecordId:present(a.approvalRecordId)?a.approvalRecordId:null,rollbackDecisionRecordId:null,candidateId:null,candidatePath:null,candidateTopic:null,authorityReview:null,authorityCalled:false,...CLOSED});

export function buildAiLogicPersistedRollbackAuthorityAdapter(input={},options={}){
  const reasons=[];
  if(input.explicitOperatorInvocation!==true) reasons.push("EXPLICIT_OPERATOR_INVOCATION_REQUIRED");
  if(!present(input.approvalRecordId)) reasons.push("APPROVAL_RECORD_ID_REQUIRED");
  if(!present(input.currentSourceCommit)) reasons.push("CURRENT_SOURCE_COMMIT_REQUIRED");
  if(reasons.length) return fail(reasons,input);
  let resolved;
  try{
    resolved=resolveAiLogicPersistedApprovalAndDecision({approvalRecordId:input.approvalRecordId},{approvalPath:options.approvalPath,promotionPath:options.promotionPath,rollbackPath:options.rollbackPath});
  }catch(e){return fail([`PERSISTED_EVIDENCE_RESOLUTION_FAILED:${e?.message??"UNKNOWN"}`],input)}
  if(resolved?.eligible!==true||resolved?.status!=="AI_LOGIC_PERSISTED_EVIDENCE_RESOLVED") return fail([...(resolved?.reasons??[]),"PERSISTED_EVIDENCE_INVALID"],input);
  const approval=resolved.operatorApproval,decision=resolved.decisionEvidence;
  if(approval?.action!=="ROLLBACK") return fail(["ROLLBACK_APPROVAL_REQUIRED"],input);
  if(decision?.version!=="ai_logic_rollback_decision_evidence_store_v1") return fail(["ROLLBACK_DECISION_EVIDENCE_REQUIRED"],input);
  let knownGood,manifest;
  try{knownGood=readAiLogicKnownGoodRecordById(decision.knownGoodRecordId,options.knownGoodPath)}catch(e){return fail([`KNOWN_GOOD_RESOLUTION_FAILED:${e?.message??"UNKNOWN"}`],input)}
  try{manifest=verifyImmutablePolicyManifest({rootDir:options.rootDir})}catch(e){return fail([`IMMUTABLE_MANIFEST_REVALIDATION_FAILED:${e?.message??"UNKNOWN"}`],input)}
  const authorityApproval=Object.freeze({...approval,rollbackDecisionRecordId:approval.decisionRecordId});
  const authority=buildAiLogicRollbackExecutionAuthorityContract({rollbackEvidence:decision,operatorApproval:authorityApproval,currentSourceCommit:input.currentSourceCommit,immutableManifest:manifest,knownGood});
  if(authority?.eligible!==true||authority?.status!=="AI_LOGIC_ROLLBACK_EXECUTION_AUTHORITY_REVIEW_READY"||authority?.disposition!=="OPERATOR_APPROVED_ROLLBACK_AUTHORITY_EVIDENCE_ONLY") return fail([...(authority?.reasons??[]),"ROLLBACK_AUTHORITY_REVIEW_NOT_READY"],input);
  return Object.freeze({version:VERSION,eligible:true,status:"AI_LOGIC_PERSISTED_ROLLBACK_AUTHORITY_ADAPTER_READY",disposition:"OPERATOR_APPROVED_ROLLBACK_AUTHORITY_EVIDENCE_ONLY",reasons:Object.freeze([]),approvalRecordId:approval.recordId,rollbackDecisionRecordId:decision.recordId,candidateId:decision.candidateId,candidatePath:decision.candidatePath,candidateTopic:decision.candidateTopic,candidateSourceHash:decision.candidateSourceHash,replayId:decision.replayId,knownGoodRecordId:decision.knownGoodRecordId,currentSourceCommit:decision.sourceCommitAfter,targetSourceCommit:decision.sourceCommitBefore,authorityReview:authority,authorityCalled:true,...CLOSED});
}
export default Object.freeze({VERSION,buildAiLogicPersistedRollbackAuthorityAdapter});
