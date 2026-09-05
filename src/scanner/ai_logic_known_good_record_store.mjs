import fs from "node:fs";
import path from "node:path";

export const VERSION="ai_logic_known_good_record_store_v1";
export const DEFAULT_PATH=path.resolve("runs/ai_logic_known_good_records.jsonl");
const LOCKS=["persistenceAllowed","productionRuntimeWiringAllowed","strategySwitchingAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","rollbackExecutable","promotionEligible"];
const present=v=>typeof v==="string"&&v.trim().length>0;
function validate(r){
  if(r?.version!=="ai_logic_known_good_record_v1"||r?.valid!==true||r?.status!=="KNOWN_GOOD_RECORD_VALID"||r?.rollbackTargetIdentified!==true||r?.immutableManifestStatus!=="IMMUTABLE_MANIFEST_VERIFIED") throw new Error("KNOWN_GOOD_RECORD_INVALID");
  for(const k of ["recordId","versionId","sourceCommit","recordedAt","logicScope"]) if(!present(r?.[k])) throw new Error(`KNOWN_GOOD_${k}_REQUIRED`);
  if(!Number.isFinite(Date.parse(r.recordedAt))) throw new Error("KNOWN_GOOD_RECORDED_AT_INVALID");
  for(const k of LOCKS) if(r?.[k]!==false) throw new Error(`KNOWN_GOOD_LOCK_OPEN_${k}`);
  return r;
}
function rows(filePath){
  if(!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath,"utf8").split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{throw new Error("KNOWN_GOOD_LEDGER_MALFORMED")}});
}
export function appendAiLogicKnownGoodRecord(record,filePath=DEFAULT_PATH){
  validate(record);
  const dir=path.dirname(filePath);
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  try{fs.chmodSync(dir,0o700)}catch{}
  const existing=rows(filePath);
  const matches=existing.filter(r=>r?.recordId===record.recordId);
  if(matches.length>1) throw new Error("KNOWN_GOOD_DUPLICATE_RECORD_ID");
  if(matches.length===1){
    validate(matches[0]);
    if(JSON.stringify(matches[0])!==JSON.stringify(record)) throw new Error("KNOWN_GOOD_IDENTITY_DRIFT");
    return Object.freeze({appended:false,record:Object.freeze({...matches[0]}),filePath,localJsonlOnly:true});
  }
  fs.appendFileSync(filePath,JSON.stringify(record)+"\n",{encoding:"utf8",mode:0o600});
  try{fs.chmodSync(filePath,0o600)}catch{}
  return Object.freeze({appended:true,record:Object.freeze({...record}),filePath,localJsonlOnly:true});
}
export function readAiLogicKnownGoodRecordById(recordId,filePath=DEFAULT_PATH){
  if(!present(recordId)) throw new Error("KNOWN_GOOD_RECORD_ID_REQUIRED");
  const matches=rows(filePath).filter(r=>r?.recordId===recordId);
  if(matches.length===0) throw new Error("KNOWN_GOOD_RECORD_NOT_FOUND");
  if(matches.length!==1) throw new Error("KNOWN_GOOD_DUPLICATE_RECORD_ID");
  return Object.freeze({...validate(matches[0])});
}
export default Object.freeze({VERSION,DEFAULT_PATH,appendAiLogicKnownGoodRecord,readAiLogicKnownGoodRecordById});
