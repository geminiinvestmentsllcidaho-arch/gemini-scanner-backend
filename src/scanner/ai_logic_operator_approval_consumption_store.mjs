import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION="ai_logic_operator_approval_consumption_store_v1";
export const DEFAULT_PATH=path.resolve("runs/ai_logic_operator_approval_consumptions.jsonl");
const present=v=>typeof v==="string"&&v.trim().length>0;
const hash=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0,32);

function readRows(filePath){
  if(!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath,"utf8").split("\n").filter(Boolean).map(line=>JSON.parse(line));
}
function lockPath(filePath){return `${filePath}.lock`}
function acquire(filePath){
  const lp=lockPath(filePath);
  fs.mkdirSync(path.dirname(filePath),{recursive:true,mode:0o700});
  fs.chmodSync(path.dirname(filePath),0o700);
  const fd=fs.openSync(lp,"wx",0o600);
  return {fd,lp};
}
function release(lock){
  try{fs.closeSync(lock.fd)}finally{try{fs.unlinkSync(lock.lp)}catch{}}
}
export function appendAiLogicOperatorApprovalConsumptionRecord(record,filePath=DEFAULT_PATH){
  if(record?.version!=="ai_logic_operator_approval_consumption_record_v1"||record?.eligible!==true) throw new Error("operator_approval_consumption_record_invalid");
  for(const k of ["approvalRecordId","nonce","action","decisionRecordId","currentSourceCommit","targetSourceCommit"]) if(!present(record[k])) throw new Error(`operator_approval_consumption_${k}_required`);
  if(!["PROMOTION","ROLLBACK"].includes(record.action)) throw new Error("operator_approval_consumption_action_invalid");
  if(record.productionRuntimeWiringAllowed!==false||record.promotionExecutionAllowed!==false||record.rollbackExecutionAllowed!==false||record.brokerContactAllowed!==false||record.orderPlacementAllowed!==false||record.liveTradingAllowed!==false||record.accountMutationAllowed!==false||record.immutablePolicyMutationAllowed!==false||record.thresholdMutationAllowed!==false||record.sizingMutationAllowed!==false||record.allocationMutationAllowed!==false||record.gitMutationAllowed!==false) throw new Error("operator_approval_consumption_authority_open");
  const identity={approvalRecordId:record.approvalRecordId,nonce:record.nonce,action:record.action,decisionRecordId:record.decisionRecordId,currentSourceCommit:record.currentSourceCommit,targetSourceCommit:record.targetSourceCommit};
  const stored=Object.freeze({version:VERSION,recordId:hash(identity),...identity,consumedAt:new Date().toISOString(),paperOnly:true,localJsonlOnly:true,exactlyOnce:true,productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false});
  const l=acquire(filePath);
  try{
    const rows=readRows(filePath);
    if(rows.some(r=>r.approvalRecordId===stored.approvalRecordId||r.nonce===stored.nonce)) return Object.freeze({appended:false,reason:"ALREADY_CONSUMED",record:null});
    fs.appendFileSync(filePath,JSON.stringify(stored)+"\n",{mode:0o600});
    fs.chmodSync(filePath,0o600);
    return Object.freeze({appended:true,reason:null,record:stored});
  }finally{release(l)}
}
export function isAiLogicOperatorApprovalConsumed({approvalRecordId,nonce,filePath=DEFAULT_PATH}={}){
  if(!present(approvalRecordId)||!present(nonce)) return true;
  try{return readRows(filePath).some(r=>r.approvalRecordId===approvalRecordId||r.nonce===nonce)}catch{return true}
}
