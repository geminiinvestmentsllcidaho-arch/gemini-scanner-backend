import { readAiLogicKnownGoodRecordById } from "./ai_logic_known_good_record_store.mjs";

export const VERSION="ai_logic_known_good_store_integration_v1";
const LOCKS=Object.freeze({
  productionRuntimeWiringAllowed:false,
  persistenceAllowed:false,
  promotionAllowed:false,
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
const present=v=>typeof v==="string"&&v.trim().length>0;

export function resolveAndBindAiLogicKnownGoodFromStore(input={},options={}){
  const recordId=String(input.knownGoodRecordId??"").trim();
  const sourceCommitBefore=String(input.sourceCommitBefore??"").trim();
  const reasons=[];
  if(!present(recordId)) reasons.push("KNOWN_GOOD_RECORD_ID_REQUIRED");
  if(!present(sourceCommitBefore)) reasons.push("SOURCE_COMMIT_BEFORE_REQUIRED");
  let knownGood=null;
  if(reasons.length===0){
    try{
      knownGood=readAiLogicKnownGoodRecordById(recordId,options.filePath);
    }catch(err){
      reasons.push(`STORE_${err?.message??"KNOWN_GOOD_READ_FAILED"}`);
    }
  }
  if(knownGood){
    if(knownGood.recordId!==recordId) reasons.push("KNOWN_GOOD_RECORD_ID_MISMATCH");
    if(knownGood.sourceCommit!==sourceCommitBefore) reasons.push("KNOWN_GOOD_SOURCE_COMMIT_MISMATCH");
    if(knownGood.valid!==true||knownGood.status!=="KNOWN_GOOD_RECORD_VALID") reasons.push("KNOWN_GOOD_RECORD_INVALID");
    if(knownGood.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED") reasons.push("KNOWN_GOOD_IMMUTABLE_MANIFEST_INVALID");
  }
  const eligible=reasons.length===0;
  return Object.freeze({
    version:VERSION,
    eligible,
    status:eligible?"AI_LOGIC_KNOWN_GOOD_STORE_BINDING_VALID":"AI_LOGIC_KNOWN_GOOD_STORE_BINDING_HOLD",
    disposition:eligible?"LOCAL_KNOWN_GOOD_BINDING_EVIDENCE_ONLY":"REJECT_OR_HOLD",
    reasons:Object.freeze([...new Set(reasons)].sort()),
    knownGood:eligible?knownGood:null,
    binding:Object.freeze({
      knownGoodRecordId:recordId||null,
      sourceCommitBefore:sourceCommitBefore||null,
    }),
    readOnly:true,
    localJsonlOnly:true,
    storeWritePerformed:false,
    executionSideEffects:"NONE",
    gitEffects:"NONE",
    ...LOCKS,
  });
}
export default Object.freeze({VERSION,resolveAndBindAiLogicKnownGoodFromStore});
