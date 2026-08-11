#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createAdminOperationalEmailDelivery } from "../src/scanner/admin_operational_notification_delivery.mjs";
const execFileAsync=promisify(execFile);
const ledger=path.resolve("runs/infrastructure_website_watchdog_incidents.jsonl");
const interval=Math.max(60000,Number(process.env.GS_INFRA_WATCHDOG_INTERVAL_MS||60000));
const allowEmail=String(process.env.GS_INFRA_WATCHDOG_EMAIL_SEND_AUTHORIZED||"").toLowerCase()==="true";
const clean=(v,n=500)=>String(v??"").trim().slice(0,n);
const parse=(v)=>{try{return JSON.parse(v)}catch{return null}};
async function probe(url){const started=Date.now();const c=new AbortController();const t=setTimeout(()=>c.abort(),10000);t.unref?.();try{const r=await fetch(url,{redirect:"follow",signal:c.signal});const body=await r.text();return{url,ok:r.ok,statusCode:r.status,latencyMs:Date.now()-started,body:body.slice(0,700)}}catch(e){return{url,ok:false,statusCode:null,latencyMs:Date.now()-started,errorCode:clean(e?.name||"FETCH_FAILED",120)}}finally{clearTimeout(t)}}
function latest(){try{return parse(fs.readFileSync(ledger,"utf8").trim().split(/\r?\n/).filter(Boolean).at(-1))??null}catch{return null}}
function append(row){fs.mkdirSync(path.dirname(ledger),{recursive:true,mode:0o700});fs.appendFileSync(ledger,JSON.stringify(row)+"\n",{mode:0o600});try{fs.chmodSync(ledger,0o600)}catch{}}
async function send(report,state){
 const delivery=createAdminOperationalEmailDelivery();
 return delivery.send({
  source:"infrastructure",
  severity:state.alertKind==="recovery"?"recovery":"critical",
  transition:state.transition,
  reportStatus:report.status,
  failureCodes:report.failureCodes,
  generatedAt:report.generatedAt,
 });
}

async function cycle(){
 const [root,publicHealth,localHealth,localReadiness,pm2Raw,dfRaw]=await Promise.all([
  probe("https://geminiscanner.net/"),probe("https://geminiscanner.net/health"),
  probe("http://127.0.0.1:3000/health"),probe("http://127.0.0.1:3000/readiness"),
  execFileAsync("pm2",["jlist"],{maxBuffer:2097152,timeout:10000}),
  execFileAsync("df",["-Pk","/"],{timeout:10000})
 ]);
 const pm2=parse(pm2Raw.stdout)||[];
 const expected=new Map([["gemini-scanner","online"],["gemini-ops-ai-watchdog","online"],["gemini-dry-scanner","stopped"]]);
 const mismatches=[];for(const [name,status] of expected){const actual=pm2.find(r=>r.name===name)?.pm2_env?.status||"missing";if(actual!==status)mismatches.push({name,expected:status,actual})}
 const fields=dfRaw.stdout.trim().split(/\r?\n/).at(-1).trim().split(/\s+/);const diskUsedPct=Number(String(fields[4]||"0").replace("%",""));
 const memoryUsedPct=((os.totalmem()-os.freemem())/os.totalmem())*100;const loadPerCpu=os.loadavg()[0]/Math.max(1,os.cpus().length);
 const health=parse(localHealth.body);const readiness=parse(localReadiness.body);const failureCodes=[];
 if(!root.ok||root.statusCode!==200)failureCodes.push("PUBLIC_SITE_UNAVAILABLE");
 if(!publicHealth.ok||publicHealth.statusCode!==200)failureCodes.push("PUBLIC_HEALTH_UNAVAILABLE");
 if(!localHealth.ok||health?.status!=="ok")failureCodes.push("LOCAL_HEALTH_FAILED");
 if(!localReadiness.ok||readiness?.ready!==true)failureCodes.push("LOCAL_READINESS_FAILED");
 if(mismatches.length)failureCodes.push("PM2_INVARIANT_FAILED");
 if(diskUsedPct>=90)failureCodes.push("DISK_USAGE_CRITICAL");
 if(memoryUsedPct>=92)failureCodes.push("MEMORY_USAGE_CRITICAL");
 if(loadPerCpu>=2)failureCodes.push("LOAD_CRITICAL");
 const report={version:"infrastructure_website_watchdog_v1",generatedAt:new Date().toISOString(),status:failureCodes.length?"unhealthy":"healthy",healthy:failureCodes.length===0,failureCodes,checks:{root,publicHealth,localHealth:{statusCode:localHealth.statusCode,parsed:health},localReadiness:{statusCode:localReadiness.statusCode,parsed:readiness},host:{uptimeSec:os.uptime(),diskUsedPct,memoryUsedPct,loadPerCpu},pm2:{mismatches}},readOnly:true,remediationAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,liveTradingAllowed:false};
 const prev=latest();const prevOpen=prev?.open===true;const state=!report.healthy&&!prevOpen?{transition:"opened",open:true,shouldAlert:true,alertKind:"failure",openedAt:report.generatedAt}:report.healthy&&prevOpen?{transition:"recovered",open:false,shouldAlert:true,alertKind:"recovery",openedAt:prev.openedAt||null}:{transition:"none",open:!report.healthy,shouldAlert:false,alertKind:null,openedAt:prev?.openedAt||(!report.healthy?report.generatedAt:null)};
 const alert=state.shouldAlert&&allowEmail?await send(report,state):{attempted:false,delivered:false,reason:state.shouldAlert?"email_send_not_authorized":"transition_not_alertable"};
 append({version:report.version,...state,generatedAt:report.generatedAt,reportStatus:report.status,failureCodes,alert});
 process.stdout.write(JSON.stringify({report,transition:state,alert,emailSendAuthorized:allowEmail,readOnly:true})+"\n");
}
let running=false;async function tick(){if(running)return;running=true;try{await cycle()}catch(e){process.stderr.write(JSON.stringify({version:"infrastructure_website_watchdog_runner_v1",error:clean(e?.message||e),readOnly:true})+"\n")}finally{running=false}}
await tick();const timer=setInterval(tick,interval);const stop=()=>{clearInterval(timer);process.exit(0)};process.once("SIGINT",stop);process.once("SIGTERM",stop);
