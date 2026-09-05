export const VERSION="ai_logic_execution_preview_contract_v1";
const present=v=>typeof v==="string"&&v.trim().length>0;
const LOCKS=["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];
export function buildAiLogicExecutionPreviewContract({consumptionRecord,immutableManifest,decisionIdentity,knownGood,candidateTarget}={}){
  const reasons=[];
  if(consumptionRecord?.version!=="ai_logic_operator_approval_consumption_record_v1"||consumptionRecord?.eligible!==true) reasons.push("CONSUMPTION_RECORD_INVALID");
  for(const k of ["approvalRecordId","nonce","action","decisionRecordId","candidateSourceHash","currentSourceCommit","targetSourceCommit"]) if(!present(consumptionRecord?.[k])) reasons.push("CONSUMPTION_IDENTITY_INCOMPLETE");
  for(const k of LOCKS) if(consumptionRecord?.[k]!==false) reasons.push(`${k}_MUST_BE_FALSE`);
  if(!["PROMOTION","ROLLBACK"].includes(consumptionRecord?.action)) reasons.push("ACTION_INVALID");
  if(immutableManifest?.ok!==true||immutableManifest?.status!=="IMMUTABLE_MANIFEST_VERIFIED") reasons.push("IMMUTABLE_MANIFEST_REVALIDATION_FAILED");
  if(decisionIdentity?.decisionRecordId!==consumptionRecord?.decisionRecordId) reasons.push("DECISION_IDENTITY_MISMATCH");
  if(decisionIdentity?.candidateSourceHash!==consumptionRecord?.candidateSourceHash) reasons.push("DECISION_SOURCE_HASH_MISMATCH");
  if(knownGood?.valid!==true||knownGood?.status!=="KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWN_GOOD_INVALID");
  const expectedCurrent=consumptionRecord?.action==="PROMOTION"?knownGood?.sourceCommit:candidateTarget?.sourceCommit;
  const expectedTarget=consumptionRecord?.action==="PROMOTION"?candidateTarget?.sourceCommit:knownGood?.sourceCommit;
  if(!present(expectedCurrent)||expectedCurrent!==consumptionRecord?.currentSourceCommit) reasons.push("CURRENT_SOURCE_COMMIT_DRIFT");
  if(!present(expectedTarget)||expectedTarget!==consumptionRecord?.targetSourceCommit) reasons.push("TARGET_SOURCE_COMMIT_DRIFT");
  const eligible=reasons.length===0;
  return Object.freeze({
    version:VERSION,eligible,
    status:eligible?"AI_LOGIC_EXECUTION_PREVIEW_READY":"AI_LOGIC_EXECUTION_PREVIEW_HOLD",
    disposition:eligible?"READONLY_EXECUTION_PREVIEW_ONLY":"PREVIEW_BLOCKED",
    reasons:Object.freeze(reasons),
    approvalRecordId:consumptionRecord?.approvalRecordId??null,
    nonce:consumptionRecord?.nonce??null,
    action:consumptionRecord?.action??null,
    decisionRecordId:consumptionRecord?.decisionRecordId??null,
    candidateSourceHash:consumptionRecord?.candidateSourceHash??null,
    currentSourceCommit:consumptionRecord?.currentSourceCommit??null,
    targetSourceCommit:consumptionRecord?.targetSourceCommit??null,
    previewOnly:true,paperOnly:true,gitEffects:"NONE",
    productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
    brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
    immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false
  });
}
