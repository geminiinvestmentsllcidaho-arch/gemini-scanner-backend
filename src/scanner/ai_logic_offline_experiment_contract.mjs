import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";
export const VERSION = "ai_logic_offline_experiment_contract_v1";
export const ALLOWED_EXPERIMENT_TOPICS = Object.freeze(["evidence_interpretation","false_positive_classification_logic","missed_opportunity_classification_logic","decision_timing_logic_without_threshold_mutation","classification_coverage"]);
export const BLOCKED_EXPERIMENT_TOPICS = Object.freeze(["position_sizing","allocation_percentage","scale_in_percentage_or_threshold","scale_out_percentage_or_threshold","authorization_minimum_or_threshold","confidence_floor_as_authorization","day_change_entry_ceiling","loss_or_exit_numeric_threshold","hard_loss_cooldown_duration","portfolio_wind_down_behavior","capital_or_buying_power_limit","paper_only_or_live_trading_authorization","broker_order_account_safety_boundary","ranking_engine_direct_mutation","production_runtime_wiring"]);
const clean=(value,max=256)=>String(value??"").trim().slice(0,max);
export function evaluateOfflineExperimentEligibility(input={},options={}){
  const manifest=options.manifestResult??verifyImmutablePolicyManifest(options);
  const topic=clean(input.topic,128),candidateId=clean(input.candidateId,128),blockers=[];
  if(manifest.ok!==true)blockers.push("IMMUTABLE_MANIFEST_NOT_VERIFIED");
  if(!candidateId)blockers.push("CANDIDATE_ID_REQUIRED");
  if(!ALLOWED_EXPERIMENT_TOPICS.includes(topic))blockers.push(BLOCKED_EXPERIMENT_TOPICS.includes(topic)?"EXPERIMENT_TOPIC_BLOCKED":"EXPERIMENT_TOPIC_NOT_ALLOWLISTED");
  if(input.explicitFixtureOrInMemoryOnly!==true)blockers.push("OFFLINE_EXPLICIT_INPUT_REQUIRED");
  if(input.requestsExistingSourceMutation===true)blockers.push("EXISTING_SOURCE_MUTATION_BLOCKED");
  if(input.requestsProductionWiring===true)blockers.push("PRODUCTION_WIRING_BLOCKED");
  if(input.requestsLedgerWrite===true)blockers.push("LEDGER_WRITE_BLOCKED");
  const eligible=blockers.length===0;
  return Object.freeze({version:VERSION,candidateId:candidateId||null,topic:topic||null,eligible,status:eligible?"OFFLINE_EXPERIMENT_ELIGIBLE":"OFFLINE_EXPERIMENT_REJECTED",disposition:eligible?"ALLOW_DETERMINISTIC_OFFLINE_EVALUATION":"REJECT_OR_HOLD",blockers:Object.freeze(blockers),immutableManifestVerified:manifest.ok===true,experimentInput:"EXPLICIT_FIXTURE_OR_IN_MEMORY_REPORT_ONLY",deterministicBaselineCandidateEvaluationRequired:true,productionRuntimeWiringAllowed:false,autonomousPromotionAllowed:false,automaticPatchAllowed:false,scannerLogicMutationAllowed:false,thresholdMutationAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false});
}
export default Object.freeze({VERSION,ALLOWED_EXPERIMENT_TOPICS,BLOCKED_EXPERIMENT_TOPICS,evaluateOfflineExperimentEligibility});
