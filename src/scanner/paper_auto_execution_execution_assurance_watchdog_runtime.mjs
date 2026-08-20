import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { evaluatePaperAutoExecutionExecutionAssurance } from "./paper_auto_execution_execution_assurance.mjs";
import { emitAdminPaperOperationalIncident } from "./admin_paper_operational_incident_emitter.mjs";
import { readLatestAdminOperationalIncident } from "./admin_operational_incident_router.mjs";
export const VERSION = "paper_auto_execution_execution_assurance_watchdog_runtime_v1";
export const DEFAULT_LEDGER_PATH = path.join(process.cwd(), "runs", "paper_auto_execution_execution_assurance_incidents.jsonl");
const execFileAsync = promisify(execFile);
const clean = (v,n=240)=>String(v??"").replace(/[\r\n\t]+/g," ").trim().slice(0,n);

export function createIndependentAssuranceHttpAdapter({fetchImpl=globalThis.fetch,baseUrl="http://127.0.0.1:3000",timeoutMs=10000}={}){
 return Object.freeze({async getJson(route){
  if(typeof fetchImpl!=="function")throw new Error("ASSURANCE_WATCHD_FETCH_UNAVAILABLE");
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);t?.unref?.();
  try{const r=await fetchImpl(`${baseUrl}${route}`,{method:"GET",headers:{Accept:"application/json"},signal:c.signal});const body=await r.json().catch(()=>({}));return Object.freeze({ok:r.ok,statusCode:r.status,body});}finally{clearTimeout(t)}
 }});
}
export function createIndependentAssurancePm2Adapter({execFileImpl=execFileAsync}={}){
 return Object.freeze({async scannerStatus(){
  const {stdout}=await execFileImpl("pm2",["jlist"],{timeout:10000,maxBuffer:2097152});
  const rows=JSON.parse(stdout);if(!Array.isArray(rows))throw new Error("ASSURANCE_WATCHDOG_PM2_INVALID");
  const scanner=rows.find(r=>r?.name==="gemini-scanner");return clean(scanner?.pm2_env?.status,64)||"missing";
 }});
}
export async function collectIndependentAssuranceInput({http,pm2}={}){
 const x=await Promise.allSettled([pm2.scannerStatus(),http.getJson("/health"),http.getJson("/diagnostics/paper-auto-execution-continuity"),http.getJson("/diagnostics/paper-auto-execution-continuity-enter")]);
 return Object.freeze({scannerStatus:x[0].status==="fulfilled"?x[0].value:"unavailable",health:x[1].status==="fulfilled"?x[1].value:null,continuity:x[2].status==="fulfilled"?x[2].value:null,enter:x[3].status==="fulfilled"?x[3].value:null});
}

export function evaluateIndependentAssuranceWatchdog(input={},options={}){
 const now=options.now??Date.now(),failureCodes=[];
 if(input.scannerStatus!=="online")failureCodes.push("SCANNER_PROCESS_NOT_ONLINE");
 const health=input.health?.body??null,continuity=input.continuity?.body??null,enter=input.enter?.body??null;
 if(input.scannerStatus==="online"&&(!health||input.health?.ok!==true))failureCodes.push("SCANNER_HEALTH_UNAVAILABLE");
 if(input.scannerStatus==="online"&&(!continuity||input.continuity?.ok!==true))failureCodes.push("CONTINUITY_DIAGNOSTICS_UNAVAILABLE");
 if(input.scannerStatus==="online"&&(!enter||input.enter?.ok!==true))failureCodes.push("ENTER_DIAGNOSTICS_UNAVAILABLE");
 let embedded=null;
 if(continuity&&enter){
  embedded=evaluatePaperAutoExecutionExecutionAssurance({
   marketOpen:health?.stream?.marketOpen===true,
   continuity,
   enter,
   lifecycle:continuity?.lastLifecycle??enter?.lastLifecycle??null,
  },{now});
  if(Array.isArray(embedded?.failureCodes))failureCodes.push(...embedded.failureCodes);
 }
 const unique=Object.freeze([...new Set(failureCodes)]);
 return Object.freeze({
  version:VERSION,generatedAt:new Date(Number(now)).toISOString(),
  healthy:unique.length===0,status:unique.length===0?"healthy":"unhealthy",
  failureCodes:unique,scannerStatus:input.scannerStatus??"unknown",embedded,
  safety:Object.freeze({paperOnly:true,readOnly:true,remediationAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,strategyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,aiAuthorityMutationAllowed:false,blindResubmissionAllowed:false,liveTradingAllowed:false}),
 });
}

export async function runIndependentAssuranceWatchdogOnce(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now())
  const http = options.http ?? createIndependentAssuranceHttpAdapter(options.httpOptions)
  const pm2 = options.pm2 ?? createIndependentAssurancePm2Adapter(options.pm2Options)
  const ledgerPath = options.ledgerPath ?? DEFAULT_LEDGER_PATH
  const input = options.input ?? await collectIndependentAssuranceInput({ http, pm2 })
  const report = evaluateIndependentAssuranceWatchdog(input, { now: now.getTime() })
  const previous = options.previousIncident ?? readLatestAdminOperationalIncident({ ledgerPath })
  const previousOpen = previous?.open === true
  const failedRecoveryNotification =
    previous?.status === "recovered" &&
    previous?.delivery?.delivered !== true

  let incident = null
  if (report.healthy === false) {
    incident = await emitAdminPaperOperationalIncident({
      source: "paper_execution",
      category: "paper_execution_assurance",
      severity: "critical",
      failureCodes: report.failureCodes,
      summary: "Independent PAPER execution assurance watchdog detected a defined critical-path failure.",
      phase: "independent_execution_assurance",
      route: "/diagnostics/paper-auto-execution-execution-assurance",
      process: "gemini-execution-assurance-watchdog",
    }, {
      ledgerPath,
      env: options.env,
      delivery: options.delivery,
      fetchImpl: options.fetchImpl,
      now,
      cooldownMs: options.cooldownMs,
      retryCooldownMs: options.retryCooldownMs,
      allowNotificationSend: options.allowNotificationSend === true,
    })
  } else if (previousOpen || failedRecoveryNotification) {
    incident = await emitAdminPaperOperationalIncident({
      source: "paper_execution",
      category: "paper_execution_assurance",
      severity: "recovery",
      failureCodes: previous?.failureCodes ?? ["EXECUTION_ASSURANCE_RECOVERED"],
      summary: "Independent PAPER execution assurance watchdog recovered.",
      phase: "independent_execution_assurance",
      route: "/diagnostics/paper-auto-execution-execution-assurance",
      process: "gemini-execution-assurance-watchdog",
    }, {
      ledgerPath,
      env: options.env,
      delivery: options.delivery,
      fetchImpl: options.fetchImpl,
      now,
      cooldownMs: options.cooldownMs,
      retryCooldownMs: options.retryCooldownMs,
      allowNotificationSend: options.allowNotificationSend === true,
    })
  }

  return Object.freeze({
    version: VERSION,
    report,
    incident,
    ledgerPath,
    readOnly: true,
    remediationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
  })
}

export default Object.freeze({
  VERSION,
  DEFAULT_LEDGER_PATH,
  createIndependentAssuranceHttpAdapter,
  createIndependentAssurancePm2Adapter,
  collectIndependentAssuranceInput,
  evaluateIndependentAssuranceWatchdog,
  runIndependentAssuranceWatchdogOnce,
})
