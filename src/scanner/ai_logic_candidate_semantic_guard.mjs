export const VERSION = "ai_logic_candidate_semantic_guard_v1";

export const FORBIDDEN_MUTATION_INTENTS = Object.freeze([
  "position_sizing",
  "capital_allocation",
  "scale_in_percentage",
  "scale_out_percentage",
  "scale_in_threshold",
  "scale_out_threshold",
  "authorization_threshold",
  "authorization_minimum",
  "day_change_ceiling",
  "entry_price_ceiling",
  "same_symbol_hard_loss_cooldown",
  "portfolio_wind_down",
  "buying_power_limit",
  "capital_limit",
  "paper_live_authorization",
  "broker_control",
  "account_control",
]);

export const FORBIDDEN_SOURCE_PATTERNS = Object.freeze([
  Object.freeze({ id: "UNDER_FIVE_MAX_PRICE", re: /\b(?:max(?:imum)?\s+entry\s+price|under[-\s]?five\s+(?:max(?:imum)?|ceiling)|entry\s+price\s+ceiling)\b/i }),
  Object.freeze({ id: "DAY_CHANGE_CEILING", re: /\b(?:previous[-\s]?close|day[-\s]?change|momentum)\b[\s\S]{0,80}\b(?:ceiling|maximum|max|threshold|limit)\b/i }),
  Object.freeze({ id: "POSITION_SIZING", re: /\b(?:position\s+sizing|allocation\s+tier|position\s+size\s+percentage|sizing\s+percentage)\b/i }),
  Object.freeze({ id: "SCALE_PERCENTAGE", re: /\bscale[-\s]?(?:in|out)\b[\s\S]{0,80}\b(?:percentage|percent|fraction|threshold|trigger)\b/i }),
  Object.freeze({ id: "AUTHORIZATION_MINIMUM", re: /\b(?:setup\s+score|ranking\s+confidence|ranking\s+quality)\b[\s\S]{0,80}\b(?:minimum|min|threshold|requirement)\b/i }),
  Object.freeze({ id: "HARD_LOSS_COOLDOWN", re: /\b(?:same[-\s]?symbol|hard[-\s]?loss)\b[\s\S]{0,100}\b(?:cooldown|30\s*minutes?|1800000)\b/i }),
  Object.freeze({ id: "WIND_DOWN_GOVERNANCE", re: /\b(?:block|allow|resume|buy|scale|change|adjust|bypass)\w*\b[\s\S]{0,100}\b(?:portfolio\s+wind[-\s]?down|wind[-\s]?down)\b|\b(?:portfolio\s+wind[-\s]?down|wind[-\s]?down)\b[\s\S]{0,100}\b(?:block|allow|resume|buy|scale|change|adjust|bypass)\w*\b/i }),
  Object.freeze({ id: "CAPITAL_GOVERNANCE", re: /\b(?:buying\s+power|capital\s+limit|capital\s+allocation|maximum\s+invested|max\s+invested)\b[\s\S]{0,100}\b(?:change|adjust|increase|decrease|threshold|limit|percentage|percent)\b/i }),
  Object.freeze({ id: "LIVE_TRADING_CONTROL", re: /\b(?:live\s+trading|paper[-\s]?only|paper\s+trading)\b[\s\S]{0,100}\b(?:enable|disable|authorize|unlock|bypass|switch)\b/i }),
  Object.freeze({ id: "BROKER_ACCOUNT_CONTROL", re: /\b(?:broker|account)\b[\s\S]{0,80}\b(?:credential|permission|control|mutation|authorize|unlock|bypass)\b/i }),
]);

function normalizeIntent(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSource(value) {
  return String(value ?? "").replace(/\r\n/g, "\n");
}

export function evaluateAiLogicCandidateSemanticGuard(input = {}) {
  const mutationIntents = Object.freeze(
    [...new Set((Array.isArray(input.mutationIntents) ? input.mutationIntents : [])
      .map(normalizeIntent)
      .filter(Boolean))]
      .sort(),
  );
  const sourceText = normalizeSource(input.sourceText);

  const reasons = [];
  for (const intent of mutationIntents) {
    if (FORBIDDEN_MUTATION_INTENTS.includes(intent)) {
      reasons.push(`FORBIDDEN_MUTATION_INTENT:${intent}`);
    }
  }

  if (sourceText) {
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      if (pattern.re.test(sourceText)) reasons.push(`FORBIDDEN_SOURCE_PATTERN:${pattern.id}`);
    }
  }

  const eligible = reasons.length === 0;

  return Object.freeze({
    version: VERSION,
    eligible,
    status: eligible
      ? "AI_LOGIC_CANDIDATE_SEMANTIC_GUARD_PASS"
      : "AI_LOGIC_CANDIDATE_SEMANTIC_GUARD_REJECT",
    disposition: eligible
      ? "ALLOW_OFFLINE_CANDIDATE_EVALUATION_ONLY"
      : "REJECT",
    mutationIntents,
    reasons: Object.freeze([...new Set(reasons)].sort()),
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
  FORBIDDEN_MUTATION_INTENTS,
  FORBIDDEN_SOURCE_PATTERNS,
  evaluateAiLogicCandidateSemanticGuard,
});
