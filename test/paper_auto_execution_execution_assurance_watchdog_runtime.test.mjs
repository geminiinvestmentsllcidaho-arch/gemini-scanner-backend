import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  evaluateIndependentAssuranceWatchdog,
  runIndependentAssuranceWatchdogOnce,
} from "../src/scanner/paper_auto_execution_execution_assurance_watchdog_runtime.mjs";

const now=Date.parse("2026-08-20T14:30:00.000Z");
const good={
  scannerStatus:"online",
  health:{ok:true,statusCode:200,body:{status:"ok",stream:{marketOpen:false}}},
  continuity:{ok:true,statusCode:200,body:{enabled:true,lastStatus:"NO_ELIGIBLE_CANDIDATE",lastCycleStartedAt:"2026-08-20T14:29:59.000Z",lastCycleCompletedAt:"2026-08-20T14:29:59.100Z",lastSnapshotObservedAt:"2026-08-20T14:29:00.000Z",lastSnapshotFresh:false,lastSnapshotCandidateCount:0,lastEligibleCandidateCount:0,lastLifecycle:{state:"ROUND_TRIP_COMPLETED"}}},
  enter:{ok:true,statusCode:200,body:{enabled:true,lastStatus:"CONTINUITY_ENTER_NOT_REQUIRED",lastCycleStartedAt:"2026-08-20T14:29:59.100Z",lastCycleCompletedAt:"2026-08-20T14:29:59.100Z",lastLifecycle:{state:"ROUND_TRIP_COMPLETED"}}},
  readiness:{generatedAt:"2026-08-20T14:29:30.000Z",infrastructureReady:true,checks:{paperHost:true,liveDisabled:true,dryStopped:true}},
  repo:{head:"abc",upstream:"abc",clean:true},
};

test("healthy closed-market no-eligible state stays quiet and read-only",()=>{
  const r=evaluateIndependentAssuranceWatchdog(good,{now});
  assert.equal(r.healthy,true);
  assert.deepEqual(r.failureCodes,[]);
  assert.equal(r.safety.readOnly,true);
  assert.equal(r.safety.orderPlacementAllowed,false);
  assert.equal(r.safety.liveTradingAllowed,false);
});

test("scanner process outage is independently detected",()=>{
  const r=evaluateIndependentAssuranceWatchdog({...good,scannerStatus:"stopped"},{now});
  assert.equal(r.healthy,false);
  assert.ok(r.failureCodes.includes("SCANNER_PROCESS_NOT_ONLINE"));
});

test("missing continuity diagnostics is detected",()=>{
  const r=evaluateIndependentAssuranceWatchdog({...good,continuity:null},{now});
  assert.equal(r.healthy,false);
  assert.ok(r.failureCodes.includes("CONTINUITY_DIAGNOSTICS_UNAVAILABLE"));
});

test("unhealthy run persists delivered incident without remediation",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gs-assurance-watchdog-"));
  const ledgerPath=path.join(dir,"incidents.jsonl");
  let sends=0;
  const delivery={send:async()=>{sends+=1;return{delivered:true,statusCode:200,provider:"test"}}};
  const r=await runIndependentAssuranceWatchdogOnce({
    input:{...good,scannerStatus:"stopped"},
    now:new Date(now),ledgerPath,delivery,allowNotificationSend:true,
  });
  assert.equal(r.report.healthy,false);
  assert.equal(sends,1);
  assert.equal(r.remediationAllowed,false);
  assert.equal(r.orderPlacementAllowed,false);
  const rows=fs.readFileSync(ledgerPath,"utf8").trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(rows.at(-1).open,true);
  assert.equal(rows.at(-1).delivery.delivered,true);
});

test("healthy run after open incident emits delivered recovery",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gs-assurance-recovery-"));
  const ledgerPath=path.join(dir,"incidents.jsonl");
  const delivery={send:async()=>({delivered:true,statusCode:200,provider:"test"})};
  await runIndependentAssuranceWatchdogOnce({
    input:{...good,scannerStatus:"stopped"},
    now:new Date(now-10000),ledgerPath,delivery,allowNotificationSend:true,
  });
  const r=await runIndependentAssuranceWatchdogOnce({
    input:good,now:new Date(now),ledgerPath,delivery,allowNotificationSend:true,
  });
  assert.equal(r.report.healthy,true);
  const rows=fs.readFileSync(ledgerPath,"utf8").trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(rows.at(-1).status,"recovered");
  assert.equal(rows.at(-1).open,false);
  assert.equal(rows.at(-1).delivery.delivered,true);
});

test("failed incident notification is persisted and retried without remediation",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gs-assurance-retry-"));
  const ledgerPath=path.join(dir,"incidents.jsonl");
  let sends=0;
  const delivery={send:async()=>{
    sends+=1;
    return sends===1
      ? {delivered:false,statusCode:503,provider:"test"}
      : {delivered:true,statusCode:200,provider:"test"};
  }};
  const first=await runIndependentAssuranceWatchdogOnce({
    input:{...good,scannerStatus:"stopped"},
    now:new Date(now-10000),
    ledgerPath,delivery,allowNotificationSend:true,retryCooldownMs:0,
  });
  assert.equal(first.report.healthy,false);
  assert.equal(first.incident.delivery.delivered,false);
  const second=await runIndependentAssuranceWatchdogOnce({
    input:{...good,scannerStatus:"stopped"},
    now:new Date(now),
    ledgerPath,delivery,allowNotificationSend:true,retryCooldownMs:0,
  });
  assert.equal(second.report.healthy,false);
  assert.equal(sends,2);
  assert.equal(second.incident.delivery.delivered,true);
  assert.equal(second.remediationAllowed,false);
  assert.equal(second.orderPlacementAllowed,false);
});

test("integrity failures are detected without mutation",()=>{
 const r=evaluateIndependentAssuranceWatchdog({...good,readiness:{generatedAt:"2026-08-20T14:29:30.000Z",infrastructureReady:false,checks:{paperHost:false,liveDisabled:false,dryStopped:false}},repo:{head:"a",upstream:"b",clean:false}},{now});
 for(const c of ["EXECUTION_INFRASTRUCTURE_NOT_READY","PAPER_HOST_INVARIANT_FAILED","LIVE_TRADING_DISABLE_INVARIANT_FAILED","DRY_SCANNER_INVARIANT_FAILED","DEPLOYED_HEAD_UPSTREAM_MISMATCH","PRODUCTION_REPO_DIRTY"])assert.ok(r.failureCodes.includes(c));
 assert.equal(r.healthy,false);assert.equal(r.safety.thresholdMutationAllowed,false);assert.equal(r.safety.orderPlacementAllowed,false);assert.equal(r.safety.liveTradingAllowed,false);
});
test("stale readiness fails closed",()=>{
 const r=evaluateIndependentAssuranceWatchdog({...good,readiness:{...good.readiness,generatedAt:"2026-08-20T14:20:00.000Z"}},{now});
 assert.ok(r.failureCodes.includes("READINESS_STATUS_STALE"));assert.equal(r.safety.aiAuthorityMutationAllowed,false);assert.equal(r.safety.blindResubmissionAllowed,false);
});

test("safe repair restarts only readiness watcher for stale readiness",async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"g-")),ledgerPath=path.join(d,"i");let n=0;
 const repair={restartReadinessWatcher:async()=>{n++;return{attempted:true,action:"restart_readiness_watchdog",bounded:true}}};
 const r=await runIndependentAssuranceWatchdogOnce({input:{...good,readiness:{...good.readiness,generatedAt:"2026-08-20T14:20:00.000Z"}},now:new Date(now),ledgerPath,repair,allowSafeRepair:true,allowNotificationSend:false});
 assert.equal(r.safeRepairEligible,true);assert.equal(n,1);assert.equal(r.repairResult.action,"restart_readiness_watchdog");
 assert.equal(r.orderPlacementAllowed,false);assert.equal(r.liveTradingAllowed,false);
});

test("safe repair never runs for scanner or integrity failures",async()=>{
 let n=0;
 const repair={restartReadinessWatcher:async()=>{n+=1;return{attempted:true}}};
 for(const input of [
  {...good,scannerStatus:"stopped"},
  {...good,repo:{head:"a",upstream:"b",clean:false}},
  {...good,readiness:{...good.readiness,checks:{...good.readiness.checks,liveDisabled:false}}},
 ]){
  const r=await runIndependentAssuranceWatchdogOnce({input,now:new Date(now),repair,allowSafeRepair:true,allowNotificationSend:false});
  assert.equal(r.safeRepairEligible,false);
  assert.equal(r.repairResult,null);
 }
 assert.equal(n,0);
});
test("safe repair is one-shot for same open incident",async()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"g-")),l=path.join(d,"i");let n=0;
 const repair={restartReadinessWatcher:async()=>{n++;return{action:"restart_readiness_watcher"}}},input={...good,readiness:{...good.readiness,generatedAt:"2026-08-20T14:20:00.000Z"}},delivery={send:async()=>({delivered:true})};
 const a=await runIndependentAssuranceWatchdogOnce({input,now:new Date(now-1e4),ledgerPath:l,repair,allowSafeRepair:true,delivery,allowNotificationSend:true});
 const b=await runIndependentAssuranceWatchdogOnce({input,now:new Date(now),ledgerPath:l,repair,allowSafeRepair:true,delivery,allowNotificationSend:true});
 assert.equal(a.repairResult.action,"restart_readiness_watcher");assert.equal(b.repairResult,null);assert.equal(n,1);
});
