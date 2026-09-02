export const VERSION = "ai_logic_candidate_diff_allowlist_v1";

export const ALLOWED_CANDIDATE_TOPICS = Object.freeze([
  "evidence_interpretation",
  "false_positive_classification_logic",
  "missed_opportunity_classification_logic",
  "decision_timing_logic_without_threshold_mutation",
  "classification_coverage",
]);

export const ALLOWED_CANDIDATE_PATH_PREFIXES = Object.freeze([
  "src/scanner/ai_logic_candidates/",
  "test/ai_logic_candidates/",
]);

export const FORBIDDEN_POLICY_PATHS = Object.freeze([
  "src/scanner/automatic_position_sizing_policy.mjs",
  "src/scanner/automatic_position_target_allocation_policy.mjs",
  "src/scanner/paper_auto_execution_strategy_authorization.mjs",
  "src/scanner/paper_auto_execution_same_symbol_hard_loss_cooldown.mjs",
  "src/scanner/customer_portfolio_wind_down_policy.mjs",
  "src/scanner/customer_owned_position_scale_in_review_policy.mjs",
  "src/scanner/customer_owned_position_scale_out_review_policy.mjs",
  "src/scanner/customer_owned_position_exit_review_policy.mjs",
  "src/scanner/paper_auto_execution_submission_boundary.mjs",
  "src/scanner/paper_auto_execution_position_mutation_lock.mjs",
]);

export const FORBIDDEN_PATH_PREFIXES = Object.freeze([
  "src/server.js",
  "ecosystem.config",
  "scripts/",
  "runs/",
  ".env",
]);

const normalizePath = (value) =>
  String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");

const isAllowedPath = (path) =>
  ALLOWED_CANDIDATE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

const isForbiddenPath = (path) =>
  FORBIDDEN_POLICY_PATHS.includes(path)
  || FORBIDDEN_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));

export function evaluateAiLogicCandidateDiff(input = {}) {
  const topic = String(input.topic ?? "").trim();
  const changedPaths = Object.freeze(
    [...new Set((Array.isArray(input.changedPaths) ? input.changedPaths : [])
      .map(normalizePath)
      .filter(Boolean))]
      .sort(),
  );

  const reasons = [];
  if (!ALLOWED_CANDIDATE_TOPICS.includes(topic)) reasons.push("TOPIC_NOT_ALLOWLISTED");
  if (!changedPaths.length) reasons.push("NO_CHANGED_PATHS");

  for (const path of changedPaths) {
    if (isForbiddenPath(path)) {
      reasons.push(`FORBIDDEN_PATH:${path}`);
      continue;
    }
    if (!isAllowedPath(path)) reasons.push(`PATH_NOT_ALLOWLISTED:${path}`);
  }

  const eligible = reasons.length === 0;

  return Object.freeze({
    version: VERSION,
    topic,
    changedPaths,
    eligible,
    status: eligible
      ? "AI_LOGIC_CANDIDATE_DIFF_ALLOWLIST_PASS"
      : "AI_LOGIC_CANDIDATE_DIFF_ALLOWLIST_REJECT",
    disposition: eligible
      ? "ALLOW_OFFLINE_CANDIDATE_EVALUATION_ONLY"
      : "REJECT",
    reasons: Object.freeze(reasons),
    immutablePolicyMutationAllowed: false,
    thresholdMutationAllowed: false,
    sizingMutationAllowed: false,
    allocationMutationAllowed: false,
    productionRuntimeWiringAllowed: false,
    persistenceAllowed: false,
    promotionAllowed: false,
    rollbackExecutionAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({
  VERSION,
  ALLOWED_CANDIDATE_TOPICS,
  ALLOWED_CANDIDATE_PATH_PREFIXES,
  FORBIDDEN_POLICY_PATHS,
  FORBIDDEN_PATH_PREFIXES,
  evaluateAiLogicCandidateDiff,
});
