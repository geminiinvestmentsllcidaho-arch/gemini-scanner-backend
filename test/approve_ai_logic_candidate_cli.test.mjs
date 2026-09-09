import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script=path.resolve("scripts/approve_ai_logic_candidate.mjs");
const base=[
  "--action=PROMOTION",
  "--decision-record-id=d1",
  "--acceptance-record-id=a1",
  "--candidate-id=c1",
  "--known-good-record-id=kg1",
  "--replay-id=r1",
  "--source-commit-before=before",
  "--source-commit-after=after",
  "--candidate-source-hash=h1",
  "--candidate-path=src/scanner/ai_logic_candidates/c1.mjs",
  "--candidate-topic=classification_coverage",
  "--nonce=n1",
  "--explicitly-approved",
  "--one-shot",
  "--paper-only",
  "--ack-no-live-trading",
  "--ack-no-immutable-policy-mutation",
  "--issued-at=2026-09-09T12:00:00Z",
  "--expires-at=2026-09-09T13:00:00Z"
];

function run(args,cwd){
  return spawnSync(process.execPath,[script,...args],{cwd,encoding:"utf8"});
}

test("fails closed without exact safety acknowledgements",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-approval-cli-"));
  const r=run(base.filter((x)=>x!=="--ack-no-live-trading"),dir);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/NO_LIVE_TRADING_ACK_REQUIRED/);
  assert.equal(fs.existsSync(path.join(dir,"runs","ai_logic_operator_approvals.jsonl")),false);
});

test("persists one local approval and deduplicates exact replay",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-approval-cli-"));
  const first=run(base,dir);
  assert.equal(first.status,0,first.stderr);
  const one=JSON.parse(first.stdout);
  assert.equal(one.ok,true);
  assert.equal(one.appended,true);
  assert.equal(one.paperOnly,true);
  assert.equal(one.localJsonlOnly,true);
  for(const k of ["productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed","gitMutationAllowed"]) assert.equal(one[k],false,k);
  const p=path.join(dir,"runs","ai_logic_operator_approvals.jsonl");
  assert.equal(fs.statSync(p).mode&0o777,0o600);
  const second=run(base,dir);
  assert.equal(second.status,0,second.stderr);
  assert.equal(JSON.parse(second.stdout).appended,false);
  assert.equal(fs.readFileSync(p,"utf8").trim().split("\n").length,1);
});

test("rollback does not require acceptance record and still remains local only",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-approval-cli-"));
  const args=base.filter((x)=>!x.startsWith("--acceptance-record-id=")).map((x)=>x==="--action=PROMOTION"?"--action=ROLLBACK":x);
  const r=run(args,dir);
  assert.equal(r.status,0,r.stderr);
  const out=JSON.parse(r.stdout);
  assert.equal(out.action,"ROLLBACK");
  assert.equal(out.promotionExecutionAllowed,false);
  assert.equal(out.rollbackExecutionAllowed,false);
  assert.equal(out.brokerContactAllowed,false);
  assert.equal(out.gitMutationAllowed,false);
});
