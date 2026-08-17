export const VERSION = "paper_auto_execution_protective_exit_classifier_v1";

const text = (value) => String(value ?? "").trim();

const PROTECTIVE_REASON_METADATA = Object.freeze({
  CAPITAL_INVALIDATION_EXIT_REQUIRED: Object.freeze({
    protectiveType: "capital_invalidation", priority: "critical", severity: "critical",
  }),
  CAPITAL_PROTECTION_EXIT_REQUIRED: Object.freeze({
    protectiveType: "capital_protection", priority: "critical", severity: "critical",
  }),
  OWNED_POSITION_HARD_LOSS_REVIEW: Object.freeze({
    protectiveType: "hard_loss",
    priority: "critical",
    severity: "critical",
  }),
  OWNED_POSITION_SINGLE_SHARE_PROFIT_PROTECTION_EXIT: Object.freeze({
    protectiveType: "profit_protection",
    priority: "high",
    severity: "high",
  }),
  OWNED_POSITION_MULTI_SHARE_PROFIT_PROTECTION_EXIT: Object.freeze({
    protectiveType: "profit_protection",
    priority: "high",
    severity: "high",
  }),
});

export function classifyProtectivePaperExitReason(reasonCode) {
  const reason = text(reasonCode);
  const metadata = PROTECTIVE_REASON_METADATA[reason] ?? null;
  return Object.freeze({
    version: VERSION,
    reasonCode: reason || null,
    protectiveExit: Boolean(metadata),
    protectiveType: metadata?.protectiveType ?? null,
    priority: metadata?.priority ?? "normal",
    severity: metadata?.severity ?? "normal",
  });
}

export default {
  VERSION,
  classifyProtectivePaperExitReason,
};
