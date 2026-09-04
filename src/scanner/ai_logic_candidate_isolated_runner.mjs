import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const VERSION="ai_logic_candidate_isolated_runner_v1";
const LOCKS=Object.freeze({
  productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,
  brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,
  allocationMutationAllowed:false,gitMutationAllowed:false,
});
const hash=(s)=>crypto.createHash("sha256").update(String(s??"")).digest("hex");
function assertJsonCompatible(value,seen=new WeakSet()) {
  if(value===null || typeof value==="string" || typeof value==="boolean") return;
  if(typeof value==="number") { if(Number.isFinite(value)) return; throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE"); }
  if(typeof value!=="object") throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
  if(seen.has(value)) throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
  seen.add(value);
  if(Array.isArray(value)) {
    if(Object.getOwnPropertySymbols(value).length) throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
    const descs=Object.getOwnPropertyDescriptors(value);
    for(let i=0;i<value.length;i++) {
      const d=descs[String(i)];
      if(!d || d.enumerable!==true || !("value" in d)) throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
      assertJsonCompatible(d.value,seen);
    }
    for(const key of Object.keys(descs)) {
      if(key==="length") continue;
      const n=Number(key);
      if(!Number.isInteger(n) || n<0 || n>=value.length || String(n)!==key) throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
    }
  } else {
    const proto=Object.getPrototypeOf(value);
    if(proto!==Object.prototype && proto!==null) throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
    if(Object.getOwnPropertySymbols(value).length) throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
    for(const d of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if(d.enumerable!==true || !("value" in d)) throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE");
      assertJsonCompatible(d.value,seen);
    }
  }
  seen.delete(value);
}
const WORKER=String.raw`
import vm from "node:vm";
let raw="";
for await (const c of process.stdin) raw +=c;
const req=JSON.parse(raw);
const ctx=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
const mod=new vm.SourceTextModule(req.source,{
  context:ctx,
  initializeImportMeta(){throw new Error("IMPORT_META_FORBIDDEN")},
  importModuleDynamically(){throw new Error("DYNAMIC_IMPORT_FORBIDDEN")}
});
await mod.link(()=>{throw new Error("DEPENDENCY_IMPORT_FORBIDDEN")});
await mod.evaluate({timeout:req.timeoutMs});
const fn=mod.namespace.evaluateCandidate;
if(typeof fn!=="function") throw new Error("EVALUATOR_EXPORT_REQUIRED");
const out=fn(req.input);
if(out&&typeof out.then==="function") throw new Error("ASYNC_EVALUATOR_FORBIDDEN");
const seen=new WeakSet();
function valid(v){
  if(v===null||typeof v==="string"||typeof v==="boolean") return true;
  if(typeof v==="number") return Number.isFinite(v);
  if(typeof v!=="object"||seen.has(v)) return false;
  seen.add(v);
  let ok=true;
  if(Array.isArray(v)) {
    if(Object.getOwnPropertySymbols(v).length) ok=false;
    else {
      const descs=Object.getOwnPropertyDescriptors(v);
      for(let i=0;ok&&i<v.length;i++) {
        const d=descs[String(i)];
        if(!d||d.enumerable!==true||!("value" in d)||!valid(d.value)) ok=false;
      }
      for(const key of Object.keys(descs)) {
        if(!ok) break;
        if(key==="length") continue;
        const n=Number(key);
        if(!Number.isInteger(n)||n<0||n>=v.length||String(n)!==key) ok=false;
      }
    }
  } else {
    const proto=Object.getPrototypeOf(v);
    if(!(proto===null||Object.getPrototypeOf(proto)===null) || Object.getOwnPropertySymbols(v).length) ok=false;
    else for(const d of Object.values(Object.getOwnPropertyDescriptors(v))) {
      if(d.enumerable!==true||!("value" in d)||!valid(d.value)){ok=false;break;}
    }
  }
  seen.delete(v);
  return ok;
}
if(!valid(out)) throw new Error("CANDIDATE_OUTPUT_INVALID");
process.stdout.write(JSON.stringify({ok:true,output:out}));
`;

function fail(reason,extra={}) {
  return Object.freeze({
    version:VERSION,eligible:false,status:"AI_LOGIC_CANDIDATE_ISOLATED_RUNNER_REJECT",
    disposition:"REJECT_OR_HOLD",reasons:Object.freeze([reason]),...extra,...LOCKS
  });
}

export function createAiLogicIsolatedEvaluator(input={},options={}) {
  const source=String(input.sourceText??"");
  const expected=String(input.expectedSourceHash??"").trim();
  const sourceHash=hash(source);
  if(!source.trim()) return fail("CANDIDATE_SOURCE_REQUIRED");
  if(expected&&expected!==sourceHash) return fail("SOURCE_HASH_MISMATCH",{sourceHash});
  const requestedTimeout=options.timeoutMs??500;
  if(typeof requestedTimeout!=="number" || !Number.isFinite(requestedTimeout)) return fail("TIMEOUT_INVALID");
  const timeoutMs=Math.max(50,Math.min(2000,Math.trunc(requestedTimeout)));
  const evaluator=(sample)=>{
    assertJsonCompatible(sample);
    let payload;
    try { payload=JSON.stringify({source,input:sample,timeoutMs}); }
    catch { throw new Error("CANDIDATE_INPUT_NOT_SERIALIZABLE"); }
    const r=spawnSync(process.execPath,[
      "--experimental-vm-modules",
      "--experimental-permission",
      "--input-type=module",
      "-e",WORKER
    ],{
      input:payload,encoding:"utf8",timeout:timeoutMs+250,maxBuffer:262144,env:{},cwd:"/tmp",
      stdio:["pipe","pipe","pipe"]
    });
    if(r.error?.code==="ETIMEDOUT" || r.signal) throw new Error("CANDIDATE_EVALUATION_TIMEOUT");
    if(r.error) throw new Error("CANDIDATE_RUNNER_SPAWN_ERROR");
    if(r.status!==0) throw new Error("CANDIDATE_EVALUATION_ERROR");
    let parsed;
    try { parsed=JSON.parse(String(r.stdout??"")); }
    catch { throw new Error("CANDIDATE_OUTPUT_INVALID"); }
    if(parsed?.ok!==true) throw new Error("CANDIDATE_EVALUATION_ERROR");
    if(!Object.prototype.hasOwnProperty.call(parsed,"output")) throw new Error("CANDIDATE_OUTPUT_INVALID");
    return parsed.output;
  };
  Object.defineProperties(evaluator,{
    isolated:{value:true,enumerable:true},
    sourceHash:{value:sourceHash,enumerable:true},
    version:{value:VERSION,enumerable:true}
  });
  return Object.freeze({
    version:VERSION,eligible:true,status:"AI_LOGIC_CANDIDATE_ISOLATED_RUNNER_READY",
    disposition:"OFFLINE_EVALUATION_ONLY",reasons:Object.freeze([]),sourceHash,evaluator,
    isolation:"CHILD_PROCESS_VM_MODULE",importsAllowed:false,dynamicImportAllowed:false,
    asyncEvaluatorAllowed:false,timeoutEnforced:true,environmentAuthority:"EMPTY",cwd:"/tmp",...LOCKS
  });
}

export default Object.freeze({VERSION,createAiLogicIsolatedEvaluator});
