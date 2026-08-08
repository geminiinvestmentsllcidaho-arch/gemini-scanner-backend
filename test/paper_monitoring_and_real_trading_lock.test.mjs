import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPaperTradingMonitoringDiagnostics, setPaperTradingKillSwitchState, appendPaperOrderMonitoringEvent } from "../src/scanner/paper_trading_monitoring_kill_switch.mjs";
import { getRealTradingConversionLockDiagnostics } from "../src/scanner/real_trading_conversion_lock.mjs";
function tempFile(name){return path.join(os.tmpdir(),`gemini-scanner-${process.pid}-${Date.now()}-${name}`);}
test("paper monitoring kill switch remains independently safe and tracks events",async()=>{const killSwitchPath=tempFile("kill.json"),monitoringLedgerPath=tempFile("monitor.jsonl");const initial=await getPaperTradingMonitoringDiagnostics({killSwitchPath,monitoringLedgerPath});assert.equal(initial.killSwitchActive,true);assert.equal(initial.paperTradingDisabled,true);await setPaperTradingKillSwitchState({killSwitchActive:true,paperTradingDisabled:true,reason:"test disable"},{killSwitchPath,nowMs:1700000000000});await appendPaperOrderMonitoringEvent({eventType:"preview",orderId:"dry-run-1",status:"blocked",symbol:"AAPL"},{monitoringLedgerPath,nowMs:1700000000000});const after=await getPaperTradingMonitoringDiagnostics({killSwitchPath,monitoringLedgerPath});assert.equal(after.killSwitchActive,true);assert.equal(after.trackedOrderCount,1);await fs.rm(killSwitchPath,{force:true});await fs.rm(monitoringLedgerPath,{force:true});});
test("real trading conversion remains independently locked",()=>{const lock=getRealTradingConversionLockDiagnostics({nowMs:1700000000000});assert.equal(lock.version,"real_trading_conversion_lock_v1");assert.equal(lock.realTradingAllowed,false);assert.equal(lock.orderPlacementAllowed,false);assert.equal(lock.blocked,true);});
