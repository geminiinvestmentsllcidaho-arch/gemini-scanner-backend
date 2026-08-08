import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {evaluateExecutionReadiness} from "../src/scanner/execution_readiness_watcher.mjs";
import {selectExecutionRuntimeEnv,isDirectExecution} from "../scripts/run_execution_readiness_watcher.mjs";

const good=()=>({account:{ok:true,status:"connected_readonly",runtime:{baseUrlHost:"paper-api.alpaca.markets",hasRuntimeKeys:true},account:{accountBlocked:false,tradingBlocked:false}},clock:{ok:true,status:"connected_readonly",marketClock:{isOpen:false}},pm2:[{name:"gemini-dry-scanner",status:"stopped"},{name:"gemini-scanner",status:"online"}],adapter:{enabled:true},env:{PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED:"1",PAPER_AUTO_ENTER_SUBMISSION_ENABLED:"1",PAPER_AUTO_EXIT_SUBMISSION_ENABLED:"1",LIVE_TRADING_ENABLED:"0"},lifecycle:null});

test("ready does not require market open",()=>{const r=evaluateExecutionReadiness(good(),0);assert.equal(r.ready,true);assert.equal(r.checks.marketOpen,false);assert.equal(r.safety.orderPlacementAllowed,false)});
test("fails closed on disabled enter",()=>{const i=good();i.env.PAPER_AUTO_ENTER_SUBMISSION_ENABLED="0";assert.equal(evaluateExecutionReadiness(i).ready,false)});
test("fails closed on live or ambiguous lifecycle",()=>{const i=good();i.env.LIVE_TRADING_ENABLED="1";i.lifecycle={state:"ENTER_UNKNOWN"};const r=evaluateExecutionReadiness(i);assert.equal(r.ready,false);assert.ok(r.blockers.includes("liveDisabled"));assert.ok(r.blockers.includes("lifecycleNeedsReview"))});
test("selects gemini-scanner as authoritative execution runtime",()=>{const env=selectExecutionRuntimeEnv([{name:"gemini-execution-readiness-watcher",pm2_env:{ALPACA_KEY:"wrong"}},{name:"gemini-scanner",pm2_env:{ALPACA_KEY:"paper",PAPER_AUTO_ENTER_SUBMISSION_ENABLED:"1"}}]);assert.equal(env.ALPACA_KEY,"paper");assert.equal(env.PAPER_AUTO_ENTER_SUBMISSION_ENABLED,"1")});
test("missing gemini-scanner runtime fails closed",()=>assert.deepEqual(selectExecutionRuntimeEnv([{name:"other",pm2_env:{ALPACA_KEY:"x"}}]),{}));
test("direct execution detection resolves relative PM2 argv path",()=>{assert.equal(isDirectExecution("file:///home/gemini/apps/gemini-scanner-backend/scripts/run_execution_readiness_watcher.mjs","scripts/run_execution_readiness_watcher.mjs"),process.cwd()==="/home/gemini/apps/gemini-scanner-backend");assert.equal(isDirectExecution("file:///tmp/watcher.mjs","/tmp/watcher.mjs"),true)});
test("runtime has no submit path",()=>assert.doesNotMatch(fs.readFileSync("scripts/run_execution_readiness_watcher.mjs","utf8"),/submitPaperAutoOrder|submitPaperOrder\s*\(|\/v2\/orders|method:\s*["']POST/));
