#!/usr/bin/env node
import { createWatchdogEmailAdapter, runOpsAiScannerWatchdogOnce } from "../src/scanner/ops_ai_scanner_watchdog_runtime.mjs";
const sendAuthorized=String(process.env.GS_WATCHDOG_EMAIL_SEND_AUTHORIZED??"").trim().toLowerCase()==="true";
const raw=Number(process.env.GS_WATCHDOG_INTERVAL_MS??60000);
const intervalMs=Number.isFinite(raw)?Math.min(900000,Math.max(60000,Math.trunc(raw))):60000;
async function cycle(){const result=await runOpsAiScannerWatchdogOnce({allowEmailSend:sendAuthorized,email:createWatchdogEmailAdapter()});process.stdout.write(`${JSON.stringify(result)}\n`);return result;}
if(process.argv.includes("--once")){const result=await cycle();if(!result.report.healthy)process.exitCode=1;}else{let running=false;const tick=async()=>{if(running)return;running=true;try{await cycle();}catch(error){process.stderr.write(`${JSON.stringify({version:"ops_ai_scanner_watchdog_runner_v1",error:String(error?.message??error),readOnly:true})}\n`);}finally{running=false;}};await tick();const timer=setInterval(tick,intervalMs);const stop=()=>{clearInterval(timer);process.exit(0);};process.once("SIGINT",stop);process.once("SIGTERM",stop);}
