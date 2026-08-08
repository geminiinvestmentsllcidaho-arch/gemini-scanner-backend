import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {evaluateExecutionReadiness} from "../src/scanner/execution_readiness_watcher.mjs";
import {selectExecutionRuntimeEnv} from "../src/scanner/execution_readiness_runtime.mjs";

const good=()=>({
  account:{
    ok:true,
    status:"connected_readonly",
    runtime:{baseUrlHost:"paper-api.alpaca.markets",hasRuntimeKeys:true},
    account:{accountBlocked:false,tradingBlocked:false},
  },
  clock:{ok:true,status:"connected_readonly",marketClock:{isOpen:false}},
  pm2:[
    {name:"gemini-dry-scanner",status:"stopped"},
    {name:"gemini-scanner",status:"online"},
  ],
  adapter:{enabled:false},
  env:{
    PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED:"0",
    PAPER_AUTO_ENTER_SUBMISSION_ENABLED:"0",
    PAPER_AUTO_EXIT_SUBMISSION_ENABLED:"0",
    LIVE_TRADING_ENABLED:"0",
  },
  lifecycle:null,
});

test("global infrastructure can be READY while execution activation is disabled",()=>{
  const r=evaluateExecutionReadiness(good(),0);
  assert.equal(r.status,"READY");
  assert.equal(r.ready,true);
  assert.equal(r.infrastructureReady,true);
  assert.equal(r.executionActivationConfigured,false);
  assert.equal(r.executionReady,false);
  assert.deepEqual(r.blockers,[]);
  assert.equal(r.checks.marketOpen,false);
  assert.equal(r.activation.adapterEnabled,false);
  assert.equal(r.activation.boundaryEnabled,false);
  assert.equal(r.activation.enterEnabled,false);
  assert.equal(r.activation.exitEnabled,false);
  assert.equal(r.safety.orderPlacementAllowed,false);
});

test("market closed does not block infrastructure readiness",()=>{
  const r=evaluateExecutionReadiness(good(),0);
  assert.equal(r.checks.marketOpen,false);
  assert.equal(r.infrastructureReady,true);
});

test("activation configuration becomes true only when all PAPER execution switches are enabled",()=>{
  const i=good();
  i.adapter.enabled=true;
  i.env.PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED="1";
  i.env.PAPER_AUTO_ENTER_SUBMISSION_ENABLED="1";
  i.env.PAPER_AUTO_EXIT_SUBMISSION_ENABLED="1";
  const r=evaluateExecutionReadiness(i,0);
  assert.equal(r.infrastructureReady,true);
  assert.equal(r.executionActivationConfigured,true);
  assert.equal(r.executionReady,true);
});

test("disabled ENTER is activation state, not an infrastructure blocker",()=>{
  const i=good();
  i.adapter.enabled=true;
  i.env.PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED="1";
  i.env.PAPER_AUTO_EXIT_SUBMISSION_ENABLED="1";
  const r=evaluateExecutionReadiness(i,0);
  assert.equal(r.infrastructureReady,true);
  assert.equal(r.executionActivationConfigured,false);
  assert.equal(r.executionReady,false);
  assert.deepEqual(r.blockers,[]);
});

test("fails closed on live trading or ambiguous lifecycle",()=>{
  const i=good();
  i.env.LIVE_TRADING_ENABLED="1";
  i.lifecycle={state:"ENTER_UNKNOWN"};
  const r=evaluateExecutionReadiness(i,0);
  assert.equal(r.infrastructureReady,false);
  assert.equal(r.executionReady,false);
  assert.ok(r.blockers.includes("liveDisabled"));
  assert.ok(r.blockers.includes("lifecycleNeedsReview"));
});

test("fails closed when PAPER host or account connectivity is invalid",()=>{
  const i=good();
  i.account.ok=false;
  i.account.runtime.baseUrlHost="api.alpaca.markets";
  const r=evaluateExecutionReadiness(i,0);
  assert.equal(r.infrastructureReady,false);
  assert.ok(r.blockers.includes("accountConnected"));
  assert.ok(r.blockers.includes("paperHost"));
});

test("selects gemini-scanner as authoritative execution runtime",()=>{
  const env=selectExecutionRuntimeEnv([
    {name:"gemini-execution-readiness-watcher",pm2_env:{ALPACA_KEY:"wrong"}},
    {name:"gemini-scanner",pm2_env:{ALPACA_KEY:"paper",PAPER_AUTO_ENTER_SUBMISSION_ENABLED:"1"}},
  ]);
  assert.equal(env.ALPACA_KEY,"paper");
  assert.equal(env.PAPER_AUTO_ENTER_SUBMISSION_ENABLED,"1");
});

test("missing gemini-scanner runtime fails closed",()=>{
  assert.deepEqual(
    selectExecutionRuntimeEnv([{name:"other",pm2_env:{ALPACA_KEY:"x"}}]),
    {},
  );
});

test("PM2 runner is unconditional and contains no entrypoint guard",()=>{
  const source=fs.readFileSync("scripts/run_execution_readiness_watcher.mjs","utf8");
  assert.match(source,/await runExecutionReadinessOnce\(\)/);
  assert.doesNotMatch(source,/isDirectExecution|import\.meta\.url|process\.argv\[1\]/);
});

test("runtime has no submit path",()=>{
  const source=[
    fs.readFileSync("scripts/run_execution_readiness_watcher.mjs","utf8"),
    fs.readFileSync("src/scanner/execution_readiness_runtime.mjs","utf8"),
    fs.readFileSync("src/scanner/execution_readiness_watcher.mjs","utf8"),
  ].join("\n");
  assert.doesNotMatch(source,/submitPaperAutoOrder|submitPaperOrder\s*\(|\/v2\/orders|method:\s*["']POST/);
});
