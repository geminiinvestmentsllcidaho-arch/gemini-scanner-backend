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
  const timeoutMs=Math.max(50,Math.min(2000,Number(options.timeoutMs??500)));
  const evaluator=(sample)=>{
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
