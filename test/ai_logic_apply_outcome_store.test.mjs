import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {buildAiLogicApplyOutcomeRecord,appendAiLogicApplyOutcomeRecord,readAiLogicApplyOutcomeRecordById,listAiLogicApplyOutcomeRecords} from "../src/scanner/ai_logic_apply_outcome_store.mjs";

const h="a".repeat(64);
const approval=Object.freeze({
  version:"ai_logic_operator_approval_record_v1",valid:true,explicitlyApproved:true,oneShot:true,paperOnly:true,
  recordId:"approval-1",nonce:"nonce-123",action:"PROMOTION",decisionRecordId:"decision-1",knownGoodRecordId:"kg-1",
  candidateSourceHash:"b".repeat(64),candidatePath:"src/scanner/ai_logic_candidates/x.mjs",candidateTopic:"classification_coverage",
  sourceCommitBefore:"before",sourceCommitAfter:"after",
});
const success=Object.freeze({
  applied:true,rolledBack:false,status:"LOCAL_SOURCE_APPLIED_VALIDATED_RUNTIME_NOT_ACTIVATED",
  candidateSourceHash:approval.candidateSourceHash,candidatePath:approval.candidatePath,candidateTopic:approval.candidateTopic,
});

test("builds immutable local-only apply outcome with closed authorities",()=>{
  const r=buildAiLogicApplyOutcomeRecord({receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h},{now:"2026-09-09T22:00:00Z"});
  assert.equal(r.applied,true);
  assert.equal(r.outcomeStatus,success.status);
  assert.equal(r.currentSourceCommit,"before");
  assert.equal(r.targetSourceCommit,"after");
  assert.equal(r.runtimeActivated,false);
  assert.equal(r.liveTradingAllowed,false);
  assert.equal(r.immutablePolicyMutationAllowed,false);
  assert.equal(r.gitMutationAllowed,false);
});

test("rejects receipt provenance drift and inconsistent success shape",()=>{
  assert.throws(()=>buildAiLogicApplyOutcomeRecord({receipt:{...success,candidatePath:"src/scanner/ai_logic_candidates/y.mjs"},operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h}),/RECEIPT_BINDING_MISMATCH_candidatePath/);
  assert.throws(()=>buildAiLogicApplyOutcomeRecord({receipt:{...success,applied:false},operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h}),/SUCCESS_SHAPE_INVALID/);
});

test("persists once at 0600 and lists newest first",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const a=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"});
    const b=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"});
    assert.equal(a.appended,true);
    assert.equal(b.duplicateSkipped,true);
    assert.equal(fs.statSync(filePath).mode&0o777,0o600);
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});


test("retry with a later recordedAt is idempotent and preserves the original record",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-retry-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const first=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"});
    const retry=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:01:00Z"});
    assert.equal(first.appended,true);
    assert.equal(retry.appended,false);
    assert.equal(retry.duplicateSkipped,true);
    assert.equal(retry.record.recordId,first.record.recordId);
    assert.equal(retry.record.recordedAt,first.record.recordedAt);
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("one approval operation identity cannot record a conflicting outcome",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-drift-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const base={operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    appendAiLogicApplyOutcomeRecord({...base,receipt:{...success,applied:false,status:"ATOMIC_APPLY_BLOCKED_PRECONDITION"}},{filePath,now:"2026-09-09T22:00:00Z"});
    assert.throws(
      ()=>appendAiLogicApplyOutcomeRecord({...base,receipt:{...success,applied:false,status:"ATOMIC_APPLY_FAILED_BEFORE_RENAME"}},{filePath,now:"2026-09-09T22:01:00Z"}),
      /APPLY_OUTCOME_IDENTITY_DRIFT/
    );
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("exact reader resolves records older than list limit and fails closed on duplicate or malformed ledger",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-exact-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    let firstId=null;
    for(let i=0;i<101;i++){
      const a={...approval,recordId:`approval-${i}`,nonce:`nonce-${i}`};
      const r=appendAiLogicApplyOutcomeRecord({receipt:{...success},operatorApproval:a,operationId:`operation-${String(i).padStart(8,"0")}`,expectedPreimageHash:h},{filePath,now:new Date(Date.UTC(2026,8,9,22,0,i)).toISOString()});
      if(i===0) firstId=r.record.recordId;
    }
    assert.equal(listAiLogicApplyOutcomeRecords({filePath,limit:100}).some(r=>r.recordId===firstId),false);
    assert.equal(readAiLogicApplyOutcomeRecordById(firstId,filePath).recordId,firstId);
    const row=readAiLogicApplyOutcomeRecordById(firstId,filePath);
    fs.appendFileSync(filePath,JSON.stringify(row)+"\n");
    assert.throws(()=>readAiLogicApplyOutcomeRecordById(firstId,filePath),/DUPLICATE_RECORD_ID/);
    fs.writeFileSync(filePath,"{bad json\n");
    assert.throws(()=>readAiLogicApplyOutcomeRecordById(firstId,filePath),/LEDGER_MALFORMED/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("list reader fails closed on invalid authority or effect rows",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-list-closed-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const written=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}).record;
    for(const drift of [
      {...written,runtimeActivationAllowed:true},
      {...written,brokerOrderAccountEffects:"ORDER"},
      {...written,paperOnly:false},
    ]){
      fs.writeFileSync(filePath,JSON.stringify(drift)+"\n");
      assert.throws(()=>listAiLogicApplyOutcomeRecords({filePath}),/APPLY_OUTCOME_(LOCK_OPEN_runtimeActivationAllowed|EFFECTS_INVALID|RECORD_INVALID)/);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("ledger file and parent symlinks fail closed without modifying targets",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-symlink-"));
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const target=path.join(dir,"target.jsonl");
    const link=path.join(dir,"link.jsonl");
    fs.writeFileSync(target,"sentinel\n");
    fs.symlinkSync(target,link);
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath:link,now:"2026-09-09T22:00:00Z"}),/APPLY_OUTCOME_LEDGER_PATH_SYMLINK/);
    assert.throws(()=>readAiLogicApplyOutcomeRecordById("missing-record",link),/APPLY_OUTCOME_LEDGER_PATH_SYMLINK/);
    assert.throws(()=>listAiLogicApplyOutcomeRecords({filePath:link}),/APPLY_OUTCOME_LEDGER_PATH_SYMLINK/);
    assert.equal(fs.readFileSync(target,"utf8"),"sentinel\n");

    const realDir=path.join(dir,"real");
    const linkedDir=path.join(dir,"linked");
    fs.mkdirSync(realDir);
    fs.symlinkSync(realDir,linkedDir,"dir");
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath:path.join(linkedDir,"outcomes.jsonl"),now:"2026-09-09T22:00:00Z"}),/APPLY_OUTCOME_LEDGER_PATH_SYMLINK/);
    assert.equal(fs.existsSync(path.join(realDir,"outcomes.jsonl")),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("reader rejects a non-regular ledger after fd open",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-fd-read-type-"));
  const filePath=path.join(dir,"outcomes.jsonl"),originalFstat=fs.fstatSync;
  try{
    fs.writeFileSync(filePath,"");
    fs.fstatSync=(fd)=>{
      const st=originalFstat(fd);
      let target="";
      try{target=fs.readlinkSync(`/proc/self/fd/${fd}`)}catch{}
      return target===filePath?{...st,isFile:()=>false}:st;
    };
    assert.throws(()=>listAiLogicApplyOutcomeRecords({filePath}),/APPLY_OUTCOME_LEDGER_TYPE_INVALID/);
  }finally{fs.fstatSync=originalFstat;fs.rmSync(dir,{recursive:true,force:true})}
});

test("writer rejects a non-regular ledger after fd open before write",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-fd-write-type-"));
  const filePath=path.join(dir,"outcomes.jsonl"),originalFstat=fs.fstatSync;
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    fs.fstatSync=(fd)=>{
      const st=originalFstat(fd);
      let target="";
      try{target=fs.readlinkSync(`/proc/self/fd/${fd}`)}catch{}
      return target===filePath?{...st,isFile:()=>false}:st;
    };
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),/APPLY_OUTCOME_LEDGER_TYPE_INVALID/);
    assert.equal(fs.existsSync(filePath),true);
    assert.equal(fs.statSync(filePath).size,0);
  }finally{fs.fstatSync=originalFstat;fs.rmSync(dir,{recursive:true,force:true})}
});

test("writer rejects a non-directory parent after fd open before lock or ledger mutation",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-parent-fd-type-"));
  const filePath=path.join(dir,"outcomes.jsonl"),originalFstat=fs.fstatSync;
  try{
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    fs.fstatSync=(fd)=>{
      const st=originalFstat(fd);
      let target="";
      try{target=fs.readlinkSync(`/proc/self/fd/${fd}`)}catch{}
      return target===dir?{...st,isDirectory:()=>false}:st;
    };
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),/APPLY_OUTCOME_LEDGER_PARENT_INVALID/);
    assert.equal(fs.existsSync(filePath),false);
    assert.equal(fs.existsSync(filePath+".lock"),false);
  }finally{fs.fstatSync=originalFstat;fs.rmSync(dir,{recursive:true,force:true})}
});


test("stale definitely-dead concurrency lock is quarantined and recovered",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-stale-lock-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const lockPath=filePath+".lock";
    fs.writeFileSync(lockPath,JSON.stringify({version:"ai_logic_apply_outcome_ledger_lock_v1",pid:2147483647,createdAtMs:Date.now()-60000,token:"dead-owner"})+"\n",{mode:0o600});
    const old=new Date(Date.now()-60000);fs.utimesSync(lockPath,old,old);
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    const out=appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"});
    assert.equal(out.appended,true);
    assert.equal(fs.existsSync(lockPath),false);
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("recent dead-owner concurrency lock remains fail closed and preserved",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-recent-dead-lock-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const lockPath=filePath+".lock";
    const body=JSON.stringify({version:"ai_logic_apply_outcome_ledger_lock_v1",pid:2147483647,createdAtMs:Date.now(),token:"recent-dead"})+"\n";
    fs.writeFileSync(lockPath,body,{mode:0o600});
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),error=>error?.code==="EEXIST");
    assert.equal(fs.readFileSync(lockPath,"utf8"),body);
    assert.equal(fs.existsSync(filePath),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("stale live-owner concurrency lock remains fail closed and preserved",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-stale-live-lock-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const lockPath=filePath+".lock";
    const body=JSON.stringify({version:"ai_logic_apply_outcome_ledger_lock_v1",pid:process.pid,createdAtMs:Date.now()-60000,token:"live-owner"})+"\n";
    fs.writeFileSync(lockPath,body,{mode:0o600});
    const old=new Date(Date.now()-60000);fs.utimesSync(lockPath,old,old);
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),error=>error?.code==="EEXIST");
    assert.equal(fs.readFileSync(lockPath,"utf8"),body);
    assert.equal(fs.existsSync(filePath),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("stale wrong-version concurrency lock remains fail closed and preserved",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-wrong-version-lock-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const lockPath=filePath+".lock";
    const body=JSON.stringify({version:"wrong_lock_v1",pid:2147483647,createdAtMs:Date.now()-60000,token:"wrong-version"})+"\n";
    fs.writeFileSync(lockPath,body,{mode:0o600});
    const old=new Date(Date.now()-60000);fs.utimesSync(lockPath,old,old);
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),error=>error?.code==="EEXIST");
    assert.equal(fs.readFileSync(lockPath,"utf8"),body);
    assert.equal(fs.existsSync(filePath),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("symlinked concurrency lock fails closed without modifying target",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-lock-symlink-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    const target=path.join(dir,"target.lock");
    fs.writeFileSync(target,"sentinel\n",{mode:0o600});
    fs.symlinkSync(target,filePath+".lock");
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),error=>error?.code==="EEXIST");
    assert.equal(fs.readFileSync(target,"utf8"),"sentinel\n");
    assert.equal(fs.lstatSync(filePath+".lock").isSymbolicLink(),true);
    assert.equal(fs.existsSync(filePath),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("lock create failure never deletes a concurrently replaced lock path",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-lock-create-race-"));
  const filePath=path.join(dir,"outcomes.jsonl"),lockPath=filePath+".lock";
  const originalFsync=fs.fsyncSync;
  const replacement=JSON.stringify({version:"ai_logic_apply_outcome_ledger_lock_v1",pid:process.pid,createdAtMs:Date.now(),token:"replacement-create"})+"\n";
  let injected=false;
  try{
    fs.fsyncSync=(fd)=>{
      if(!injected){
        injected=true;
        fs.renameSync(lockPath,lockPath+".original");
        fs.writeFileSync(lockPath,replacement,{mode:0o600});
        const error=new Error("FORCED_LOCK_FSYNC_FAILURE");error.code="EIO";throw error;
      }
      return originalFsync(fd);
    };
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),/FORCED_LOCK_FSYNC_FAILURE/);
    assert.equal(fs.readFileSync(lockPath,"utf8"),replacement);
    assert.equal(fs.existsSync(filePath),false);
  }finally{fs.fsyncSync=originalFsync;fs.rmSync(dir,{recursive:true,force:true})}
});

test("lock release race preserves replacement instead of unlinking it",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-lock-release-race-"));
  const filePath=path.join(dir,"outcomes.jsonl"),lockPath=filePath+".lock";
  const originalRename=fs.renameSync;
  const replacement=JSON.stringify({version:"ai_logic_apply_outcome_ledger_lock_v1",pid:process.pid,createdAtMs:Date.now(),token:"replacement-release"})+"\n";
  let injected=false;
  try{
    fs.renameSync=(from,to)=>{
      if(!injected&&from===lockPath&&String(to).includes(".owned-")){
        injected=true;
        originalRename(lockPath,lockPath+".original");
        fs.writeFileSync(lockPath,replacement,{mode:0o600});
      }
      return originalRename(from,to);
    };
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),/APPLY_OUTCOME_LEDGER_LOCK_OWNERSHIP_CHANGED/);
    assert.equal(fs.readFileSync(lockPath,"utf8"),replacement);
    assert.equal(listAiLogicApplyOutcomeRecords({filePath}).length,1);
  }finally{fs.renameSync=originalRename;fs.rmSync(dir,{recursive:true,force:true})}
});

test("existing concurrency lock fails closed without modifying ledger",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-outcome-lock-"));
  const filePath=path.join(dir,"outcomes.jsonl");
  try{
    fs.writeFileSync(filePath+".lock","held\n",{mode:0o600});
    const input={receipt:success,operatorApproval:approval,operationId:"operation-123",expectedPreimageHash:h};
    assert.throws(()=>appendAiLogicApplyOutcomeRecord(input,{filePath,now:"2026-09-09T22:00:00Z"}),error=>error?.code==="EEXIST");
    assert.equal(fs.existsSync(filePath),false);
    assert.equal(fs.readFileSync(filePath+".lock","utf8"),"held\n");
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
