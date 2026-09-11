import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION="ai_logic_apply_outcome_store_v1";
export const DEFAULT_PATH=path.resolve("runs/ai_logic_apply_outcomes.jsonl");
const STATUSES=new Set([
  "LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",
  "ATOMIC_APPLY_BLOCKED_PRECONDITION",
  "ATOMIC_APPLY_FAILED_ROLLED_BACK",
  "ATOMIC_APPLY_FAILED_BEFORE_RENAME",
  "LOCAL_INTEGRATION_EXECUTION_SEAM_BLOCKED",
  "ONE_SHOT_NONRUNTIME_INVOCATION_BLOCKED",
  "ONE_SHOT_CONSUMPTION_FAILED",
  "ONE_SHOT_CONSUMPTION_BLOCKED",
  "ONE_SHOT_CONSUMPTION_STORE_BINDING_FAILED",
  "ONE_SHOT_EXECUTION_FAILED_AFTER_CONSUMPTION",
]);
const present=v=>typeof v==="string"&&v.trim().length>0;
const hash=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0,32);
const LOCKS=["runtimeActivationAllowed","productionRuntimeWiringAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"];

export function buildAiLogicApplyOutcomeRecord({receipt,operatorApproval,operationId,expectedPreimageHash}={},options={}){
  if(!receipt||!STATUSES.has(receipt.status)) throw new Error("APPLY_OUTCOME_STATUS_INVALID");
  if(operatorApproval?.version!=="ai_logic_operator_approval_record_v1"||operatorApproval?.valid!==true||operatorApproval?.explicitlyApproved!==true||operatorApproval?.oneShot!==true||operatorApproval?.paperOnly!==true) throw new Error("APPLY_OUTCOME_APPROVAL_INVALID");
  for(const k of ["recordId","nonce","action","decisionRecordId","knownGoodRecordId","candidateSourceHash","candidatePath","candidateTopic","sourceCommitBefore","sourceCommitAfter"]) if(!present(operatorApproval?.[k])) throw new Error(`APPLY_OUTCOME_${k}_REQUIRED`);
  if(!["PROMOTION","ROLLBACK"].includes(operatorApproval.action)) throw new Error("APPLY_OUTCOME_ACTION_INVALID");
  if(!/^[A-Za-z0-9._-]{8,128}$/.test(String(operationId??""))) throw new Error("APPLY_OUTCOME_OPERATION_ID_INVALID");
  if(!/^[a-f0-9]{64}$/i.test(String(expectedPreimageHash??""))) throw new Error("APPLY_OUTCOME_PREIMAGE_HASH_INVALID");
  for(const k of ["candidateSourceHash","candidatePath","candidateTopic"]) if(receipt?.[k]!==operatorApproval[k]) throw new Error(`APPLY_OUTCOME_RECEIPT_BINDING_MISMATCH_${k}`);
  const applied=receipt.applied===true;
  const rolledBack=receipt.rolledBack===true;
  if(receipt.status==="LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED"&&(!applied||rolledBack)) throw new Error("APPLY_OUTCOME_SUCCESS_SHAPE_INVALID");
  if(receipt.status==="ATOMIC_APPLY_FAILED_ROLLED_BACK"&&(applied||!rolledBack)) throw new Error("APPLY_OUTCOME_ROLLBACK_SHAPE_INVALID");
  if(receipt.status!=="LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED"&&applied) throw new Error("APPLY_OUTCOME_APPLIED_STATUS_MISMATCH");
  const now=options.now instanceof Date?options.now:new Date(options.now??Date.now());
  if(!Number.isFinite(now.getTime())) throw new Error("APPLY_OUTCOME_TIME_INVALID");
  const currentSourceCommit=operatorApproval.action==="PROMOTION"?operatorApproval.sourceCommitBefore:operatorApproval.sourceCommitAfter;
  const targetSourceCommit=operatorApproval.action==="PROMOTION"?operatorApproval.sourceCommitAfter:operatorApproval.sourceCommitBefore;
  const identity={
    approvalRecordId:operatorApproval.recordId,
    nonce:operatorApproval.nonce,
    action:operatorApproval.action,
    decisionRecordId:operatorApproval.decisionRecordId,
    knownGoodRecordId:operatorApproval.knownGoodRecordId,
    operationId,
    candidateSourceHash:operatorApproval.candidateSourceHash,
    candidatePath:operatorApproval.candidatePath,
    candidateTopic:operatorApproval.candidateTopic,
    currentSourceCommit,
    targetSourceCommit,
    expectedPreimageHash:String(expectedPreimageHash).toLowerCase(),
  };
  return Object.freeze({
    version:VERSION,
    recordId:hash(identity),
    recordedAt:now.toISOString(),
    ...identity,
    outcomeStatus:receipt.status,
    applied,
    rolledBack,
    errorCode:present(receipt.errorCode)?receipt.errorCode.slice(0,200):null,
    localJsonlOnly:true,
    paperOnly:true,
    runtimeActivated:false,
    pm2RestartPerformed:false,
    gitMutationPerformed:false,
    brokerOrderAccountEffects:"NONE",
    ...Object.fromEntries(LOCKS.map(k=>[k,false])),
  });
}

function lstatIfExists(filePath){
  try{return fs.lstatSync(filePath)}catch(error){if(error?.code==="ENOENT") return null;throw error}
}
function assertSafeLedgerPath(filePath){
  const resolved=path.resolve(filePath);
  const root=path.parse(resolved).root;
  let current=root;
  for(const part of resolved.slice(root.length).split(path.sep).filter(Boolean)){
    current=path.join(current,part);
    const st=lstatIfExists(current);
    if(!st) continue;
    if(st.isSymbolicLink()) throw new Error("APPLY_OUTCOME_LEDGER_PATH_SYMLINK");
    if(current!==resolved&&!st.isDirectory()) throw new Error("APPLY_OUTCOME_LEDGER_PARENT_INVALID");
    if(current===resolved&&!st.isFile()) throw new Error("APPLY_OUTCOME_LEDGER_TYPE_INVALID");
  }
  return resolved;
}
function openLedgerParentDirectory(dir){
  let fd;
  try{
    fd=fs.openSync(dir,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
    if(!fs.fstatSync(fd).isDirectory()) throw new Error("APPLY_OUTCOME_LEDGER_PARENT_INVALID");
    fs.fchmodSync(fd,0o700);
    return fd;
  }catch(error){
    if(fd!=null) try{fs.closeSync(fd)}catch{}
    throw error;
  }
}
function rows(filePath){
  const resolved=assertSafeLedgerPath(filePath);
  let fd;
  try{fd=fs.openSync(resolved,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW)}catch(error){if(error?.code==="ENOENT") return [];throw error}
  let text;
  try{
    if(!fs.fstatSync(fd).isFile()) throw new Error("APPLY_OUTCOME_LEDGER_TYPE_INVALID");
    text=fs.readFileSync(fd,"utf8");
  }finally{fs.closeSync(fd)}
  return text.split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{throw new Error("APPLY_OUTCOME_LEDGER_MALFORMED")}});
}
const APPLY_OUTCOME_LEDGER_LOCK_STALE_MS=30_000;
function readLedgerLock(lockPath){
  let fd;
  try{
    fd=fs.openSync(lockPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    const st=fs.fstatSync(fd);
    if(!st.isFile()) return null;
    const value=JSON.parse(fs.readFileSync(fd,"utf8"));
    if(value?.version!=="ai_logic_apply_outcome_ledger_lock_v1") return null;
    const pid=Number(value?.pid),createdAtMs=Number(value?.createdAtMs),token=String(value?.token??"").trim();
    if(!Number.isInteger(pid)||pid<=0||!Number.isFinite(createdAtMs)||!token) return null;
    return {pid,createdAtMs,token,ino:st.ino,dev:st.dev,mtimeMs:st.mtimeMs};
  }catch{return null}finally{if(fd!=null) try{fs.closeSync(fd)}catch{}}
}
function ledgerLockOwnerDefinitelyDead(pid){
  try{process.kill(pid,0);return false}catch(error){return error?.code==="ESRCH"}
}
function sameLedgerLockIdentity(lockPath,observed){
  const current=readLedgerLock(lockPath);
  return !!current&&current.token===observed.token&&current.ino===observed.ino&&current.dev===observed.dev;
}
function readLedgerLockFileIdentity(lockPath){
  let fd;
  try{
    fd=fs.openSync(lockPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    const st=fs.fstatSync(fd);
    return st.isFile()?{ino:st.ino,dev:st.dev}:null;
  }catch{return null}finally{if(fd!=null) try{fs.closeSync(fd)}catch{}}
}
function removeOwnedLedgerLock(lock,errorCode,dirFd){
  const current=readLedgerLockFileIdentity(lock.lockPath);
  if(!current||current.ino!==lock.ino||current.dev!==lock.dev) throw new Error(errorCode);
  const quarantine=`${lock.lockPath}.owned-${crypto.randomUUID()}`;
  try{fs.renameSync(lock.lockPath,quarantine);fs.fsyncSync(dirFd)}catch{
    try{if(!fs.existsSync(lock.lockPath)&&fs.existsSync(quarantine)){fs.renameSync(quarantine,lock.lockPath);fs.fsyncSync(dirFd)}}catch{}
    throw new Error(errorCode);
  }
  const moved=readLedgerLockFileIdentity(quarantine);
  if(!moved||moved.ino!==lock.ino||moved.dev!==lock.dev){
    try{if(!fs.existsSync(lock.lockPath)&&fs.existsSync(quarantine)){fs.renameSync(quarantine,lock.lockPath);fs.fsyncSync(dirFd)}}catch{}
    throw new Error(errorCode);
  }
  try{fs.rmSync(quarantine,{force:true});fs.fsyncSync(dirFd)}catch(error){
    try{if(!fs.existsSync(lock.lockPath)&&fs.existsSync(quarantine)){fs.renameSync(quarantine,lock.lockPath);fs.fsyncSync(dirFd)}}catch{}
    throw error;
  }
}
function acquireLedgerLock(filePath,dirFd){
  const lockPath=`${filePath}.lock`;
  const token=crypto.randomUUID();
  const create=()=>{
    const fd=fs.openSync(lockPath,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
    let st;
    try{st=fs.fstatSync(fd)}
    catch(error){try{fs.closeSync(fd)}catch{};throw error}
    const lock={fd,lockPath,token,ino:st.ino,dev:st.dev};
    try{fs.writeSync(fd,JSON.stringify({version:"ai_logic_apply_outcome_ledger_lock_v1",pid:process.pid,createdAtMs:Date.now(),token})+"\n",null,"utf8");fs.fsyncSync(fd);fs.fsyncSync(dirFd)}
    catch(error){try{fs.closeSync(fd)}catch{};try{removeOwnedLedgerLock(lock,"APPLY_OUTCOME_LEDGER_LOCK_OWNERSHIP_CHANGED",dirFd)}catch{};throw error}
    return lock;
  };
  try{return create()}catch(error){
    if(error?.code!=="EEXIST") throw error;
    const observed=readLedgerLock(lockPath);
    const ageMs=observed?Math.max(0,Date.now()-Number(observed.mtimeMs)):0;
    if(!observed||!Number.isFinite(ageMs)||ageMs<APPLY_OUTCOME_LEDGER_LOCK_STALE_MS||!ledgerLockOwnerDefinitelyDead(observed.pid)||!sameLedgerLockIdentity(lockPath,observed)) throw error;
    const quarantine=`${lockPath}.stale-${crypto.randomUUID()}`;
    try{fs.renameSync(lockPath,quarantine);fs.fsyncSync(dirFd)}catch{
      try{if(!fs.existsSync(lockPath)&&fs.existsSync(quarantine)){fs.renameSync(quarantine,lockPath);fs.fsyncSync(dirFd)}}catch{}
      throw error;
    }
    const quarantined=readLedgerLock(quarantine);
    if(!quarantined||quarantined.token!==observed.token||quarantined.ino!==observed.ino||quarantined.dev!==observed.dev){
      try{if(!fs.existsSync(lockPath)&&fs.existsSync(quarantine)){fs.renameSync(quarantine,lockPath);fs.fsyncSync(dirFd)}}catch{}
      throw error;
    }
    try{
      const acquired=create();
      try{fs.rmSync(quarantine,{force:true});fs.fsyncSync(dirFd)}catch{}
      return acquired;
    }catch(retryError){
      try{if(!fs.existsSync(lockPath)&&fs.existsSync(quarantine)){fs.renameSync(quarantine,lockPath);fs.fsyncSync(dirFd)}}catch{}
      throw retryError;
    }
  }
}
function releaseLedgerLock(lock,dirFd){
  try{fs.closeSync(lock.fd)}finally{
    const current=readLedgerLock(lock.lockPath);
    if(!current||current.token!==lock.token||current.ino!==lock.ino||current.dev!==lock.dev) throw new Error("APPLY_OUTCOME_LEDGER_LOCK_OWNERSHIP_CHANGED");
    removeOwnedLedgerLock(lock,"APPLY_OUTCOME_LEDGER_LOCK_OWNERSHIP_CHANGED",dirFd);
  }
}

export function appendAiLogicApplyOutcomeRecord(input={},options={}){
  const record=buildAiLogicApplyOutcomeRecord(input,options);
  const filePath=assertSafeLedgerPath(options.filePath??DEFAULT_PATH);
  const dir=path.dirname(filePath);
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  assertSafeLedgerPath(filePath);
  const dirFd=openLedgerParentDirectory(dir);
  try{
    const lock=acquireLedgerLock(filePath,dirFd);
    try{
    const existing=rows(filePath);
    const matches=existing.filter(r=>r?.recordId===record.recordId);
    if(matches.length>1) throw new Error("APPLY_OUTCOME_DUPLICATE_RECORD_ID");
    if(matches.length===1){
      const stored=matches[0];
      const comparable=({recordedAt,...rest})=>rest;
      if(JSON.stringify(comparable(stored))!==JSON.stringify(comparable(record))) throw new Error("APPLY_OUTCOME_IDENTITY_DRIFT");
      return Object.freeze({appended:false,duplicateSkipped:true,record:Object.freeze({...stored}),filePath,localJsonlOnly:true});
    }
    const fd=fs.openSync(filePath,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_APPEND|fs.constants.O_NOFOLLOW,0o600);
    try{
      if(!fs.fstatSync(fd).isFile()) throw new Error("APPLY_OUTCOME_LEDGER_TYPE_INVALID");
      fs.fchmodSync(fd,0o600);fs.writeSync(fd,JSON.stringify(record)+"\n",null,"utf8");fs.fsyncSync(fd);
    }finally{fs.closeSync(fd)}
    fs.fsyncSync(dirFd);
    return Object.freeze({appended:true,duplicateSkipped:false,record,filePath,localJsonlOnly:true});
    }finally{releaseLedgerLock(lock,dirFd)}
  }finally{fs.closeSync(dirFd)}
}

function validatePersistedApplyOutcomeRecord(record){
  if(record?.version!==VERSION||record?.localJsonlOnly!==true||record?.paperOnly!==true) throw new Error("APPLY_OUTCOME_RECORD_INVALID");
  for(const k of LOCKS) if(record?.[k]!==false) throw new Error(`APPLY_OUTCOME_LOCK_OPEN_${k}`);
  if(record.runtimeActivated!==false||record.pm2RestartPerformed!==false||record.gitMutationPerformed!==false||record.brokerOrderAccountEffects!=="NONE") throw new Error("APPLY_OUTCOME_EFFECTS_INVALID");
  return Object.freeze({...record});
}

export function readAiLogicApplyOutcomeRecordById(recordId,filePath=DEFAULT_PATH){
  if(!present(recordId)) throw new Error("APPLY_OUTCOME_RECORD_ID_REQUIRED");
  const resolved=path.resolve(filePath);
  const matches=rows(resolved).filter(r=>r?.recordId===recordId);
  if(matches.length===0) throw new Error("APPLY_OUTCOME_RECORD_NOT_FOUND");
  if(matches.length!==1) throw new Error("APPLY_OUTCOME_DUPLICATE_RECORD_ID");
  return validatePersistedApplyOutcomeRecord(matches[0]);
}

export function listAiLogicApplyOutcomeRecords(options={}){
  const filePath=path.resolve(options.filePath??DEFAULT_PATH);
  const raw=Number(options.limit??20);
  const limit=Number.isFinite(raw)?Math.max(1,Math.min(100,Math.trunc(raw))):20;
  return Object.freeze(rows(filePath).slice(-limit).reverse().map(validatePersistedApplyOutcomeRecord));
}

export default Object.freeze({VERSION,DEFAULT_PATH,buildAiLogicApplyOutcomeRecord,appendAiLogicApplyOutcomeRecord,readAiLogicApplyOutcomeRecordById,listAiLogicApplyOutcomeRecords});
