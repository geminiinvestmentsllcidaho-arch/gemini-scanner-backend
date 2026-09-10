import { readAiLogicApplyOutcomeRecordById } from "./ai_logic_apply_outcome_store.mjs";

export const VERSION="ai_logic_apply_outcome_persistence_binding_v1";

const CLOSED=Object.freeze({
  readOnly:true,evidenceOnly:true,localJsonlOnly:true,storeWritePerformed:false,
  executionSideEffects:"NONE",gitEffects:"NONE",
  runtimeWiringAllowed:false,productionRuntimeWiringAllowed:false,persistenceAllowed:false,
  promotionAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,
  accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,
  sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false,
});
const present=v=>typeof v==="string"&&v.trim().length>0;

function snapshot(input={},p={}){
  const receipt=input.receipt??null;
  return {
    executionOutcomeStatus:receipt?.status??null,
    applied:receipt?.applied===true,
    rolledBack:receipt?.rolledBack===true,
    persistenceError:p?.error??null,
    freshAppend:p?.appended===true,
    duplicateSkipped:p?.duplicateSkipped===true,
    recordId:present(p?.recordId)?p.recordId:null,
  };
}

function fail(reasons,input={},p={}){
  return Object.freeze({
    version:VERSION,eligible:false,durable:false,durableEvidenceEligible:false,
    status:"AI_LOGIC_APPLY_OUTCOME_PERSISTENCE_BINDING_HOLD",disposition:"REJECT_OR_HOLD",
    reasons:Object.freeze([...new Set(reasons)].sort()),
    ...snapshot(input,p),
    applyOutcomeRecord:null,persistenceReceipt:Object.freeze({...p}),...CLOSED,
  });
}

export function resolveAndBindAiLogicApplyOutcomePersistence(input={},options={}){
  const receipt=input.receipt??null;
  const explicit=input.applyOutcomePersistence;
  const nested=receipt?.applyOutcomePersistence;
  const p=explicit??nested;
  const reasons=[];
  if(!receipt||typeof receipt!=="object") reasons.push("APPLY_OUTCOME_EXECUTION_RECEIPT_REQUIRED");
  if(explicit!=null&&nested!=null&&JSON.stringify(explicit)!==JSON.stringify(nested)) reasons.push("APPLY_OUTCOME_PERSISTENCE_RECEIPT_MISMATCH");
  if(p?.attempted!==true) reasons.push("APPLY_OUTCOME_PERSISTENCE_ATTEMPT_REQUIRED");
  if(p?.persisted!==true) reasons.push("APPLY_OUTCOME_PERSISTENCE_REQUIRED");
  if(p?.status!=="APPLY_OUTCOME_PERSISTED") reasons.push("APPLY_OUTCOME_PERSISTENCE_STATUS_INVALID");
  if(!present(p?.recordId)) reasons.push("APPLY_OUTCOME_RECORD_ID_REQUIRED");
  if(p?.error!=null) reasons.push("APPLY_OUTCOME_PERSISTENCE_ERROR_PRESENT");
  if(p?.appended===true&&p?.duplicateSkipped===true) reasons.push("APPLY_OUTCOME_PERSISTENCE_CONTRADICTORY");
  if(p?.appended!==true&&p?.duplicateSkipped!==true) reasons.push("APPLY_OUTCOME_PERSISTENCE_DURABILITY_UNPROVEN");
  if(p?.persisted!==true&&(p?.appended===true||p?.duplicateSkipped===true||present(p?.recordId))) reasons.push("APPLY_OUTCOME_PERSISTENCE_CONTRADICTORY");
  if(reasons.length) return fail(reasons,input,p);

  let record;
  try{
    record=readAiLogicApplyOutcomeRecordById(p.recordId,options.filePath);
  }catch(error){
    return fail([String(error?.message??"APPLY_OUTCOME_READ_FAILED").slice(0,160)],input,p);
  }

  if(record.recordId!==p.recordId) reasons.push("APPLY_OUTCOME_RECORD_ID_MISMATCH");
  if(receipt){
    if(record.outcomeStatus!==receipt.status) reasons.push("APPLY_OUTCOME_EXECUTION_STATUS_MISMATCH");
    if(record.applied!==(receipt.applied===true)) reasons.push("APPLY_OUTCOME_APPLIED_MISMATCH");
    if(record.rolledBack!==(receipt.rolledBack===true)) reasons.push("APPLY_OUTCOME_ROLLED_BACK_MISMATCH");
    for(const k of ["candidateSourceHash","candidatePath","candidateTopic"])
      if(present(receipt?.[k])&&record?.[k]!==receipt[k]) reasons.push(`APPLY_OUTCOME_${k}_MISMATCH`);
  }
  if(reasons.length) return fail(reasons,input,p);

  return Object.freeze({
    version:VERSION,eligible:true,durable:true,durableEvidenceEligible:true,
    status:"AI_LOGIC_APPLY_OUTCOME_DURABLE_EVIDENCE_VALID",
    disposition:"LOCAL_DURABLE_APPLY_OUTCOME_EVIDENCE_ONLY",
    reasons:Object.freeze([]),...snapshot(input,p),
    applyOutcomeRecord:record,persistenceReceipt:Object.freeze({...p}),...CLOSED,
  });
}
export default Object.freeze({VERSION,resolveAndBindAiLogicApplyOutcomePersistence});
