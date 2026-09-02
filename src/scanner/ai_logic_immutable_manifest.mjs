import crypto from "node:crypto";
import fs from "node:fs";
export const VERSION = "ai_logic_immutable_manifest_v1";
export const IMMUTABLE_POLICY_MANIFEST = Object.freeze([
  Object.freeze({ path: "src/scanner/automatic_position_sizing_policy.mjs", sha256: "999ade4208f16abc5ec6ef8c2c2313502e2702404ede2a616ce298221cb03894" }),
  Object.freeze({ path: "src/scanner/automatic_position_target_allocation_policy.mjs", sha256: "857486be44664cc4b498eee8728fbc669aff467bfe32af32005deb0bb6b85850" }),
  Object.freeze({ path: "src/scanner/paper_auto_execution_strategy_authorization.mjs", sha256: "19fd17b9e0473dfde9a3059320f9e1fce408cd68fc38afd25a979c3889f017fd" }),
  Object.freeze({ path: "src/scanner/paper_auto_execution_same_symbol_hard_loss_cooldown.mjs", sha256: "dcbbddcee33bf9db363418b07d979cb218d88bfd96c2a2357c14892655d1a1e7" }),
  Object.freeze({ path: "src/scanner/customer_portfolio_wind_down_policy.mjs", sha256: "998327166fc86dd9032df1a13624deacbe4654de968b5e634413d850b510dd8e" }),
  Object.freeze({ path: "src/scanner/customer_owned_position_scale_in_review_policy.mjs", sha256: "37630962aa2140a9e1726df9186dae84667d4e8acd134e62f96e4db78572b8fd" }),
  Object.freeze({ path: "src/scanner/customer_owned_position_scale_out_review_policy.mjs", sha256: "aa29c510951d2b9c41225c13eb3b8acc9aa4f5e492c96166054280812f10407a" }),
  Object.freeze({ path: "src/scanner/customer_owned_position_exit_review_policy.mjs", sha256: "76b12e772022ccdf26825dc9c9b68e4af220856e480f4d4c2ade16f859550448" }),
  Object.freeze({ path: "src/scanner/paper_auto_execution_submission_boundary.mjs", sha256: "fcf5e9e7a74019e0f7cc02f8b4285fbe2438f778887bbb7693cab625848cf002" }),
  Object.freeze({ path: "src/scanner/paper_auto_execution_position_mutation_lock.mjs", sha256: "c3044f0fed90897b64ccdfda9eb0f36d6702ad2fbc537d3c36df9752e34bc52e" }),
]);
function sha256File(path){return crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")}
export function verifyImmutablePolicyManifest(options={}){
  const manifest=Array.isArray(options.manifest)?options.manifest:IMMUTABLE_POLICY_MANIFEST;
  const results=manifest.map(entry=>{
    if(!fs.existsSync(entry.path))return Object.freeze({path:entry.path,expectedSha256:entry.sha256,actualSha256:null,ok:false,status:"IMMUTABLE_FILE_MISSING"});
    const actualSha256=sha256File(entry.path);
    return Object.freeze({path:entry.path,expectedSha256:entry.sha256,actualSha256,ok:actualSha256===entry.sha256,status:actualSha256===entry.sha256?"IMMUTABLE_FILE_MATCH":"IMMUTABLE_FILE_MISMATCH"});
  });
  const ok=results.every(row=>row.ok);
  return Object.freeze({version:VERSION,ok,status:ok?"IMMUTABLE_MANIFEST_VERIFIED":"IMMUTABLE_MANIFEST_REJECT",disposition:ok?"ALLOW_OFFLINE_EXPERIMENT_EVALUATION":"REJECT",candidateMayModifyImmutableFiles:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,results:Object.freeze(results)});
}
export default Object.freeze({VERSION,IMMUTABLE_POLICY_MANIFEST,verifyImmutablePolicyManifest});
