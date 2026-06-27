import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildFirstTinyPaperOrderSubmitPreflightGate } from "./first_tiny_paper_order_submit_preflight_gate.mjs";

export const FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_LOCK_VERSION =
  "first_tiny_paper_order_final_submit_approval_lock_v1";

export const REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE =
  "I_APPROVE_FIRST_TINY_PAPER_ORDER_SUBMIT_PATH_UNLOCK_ONLY";

const FINAL_GATE_BLOCKER = "separate_borac_submit_approval_required";

function parseArgs(argv = []) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}

function canonicalParams(params = {}) {
  return {
    symbol: String(params.symbol ?? "").trim().toUpperCase(),
    qty: Number(params.qty),
    side: String(params.side ?? "buy").trim().toLowerCase(),
    type: String(params.type ?? "market").trim().toLowerCase(),
    timeInForce: String(params.timeInForce ?? params.tif ?? "day").trim().toLowerCase()
  };
}

export function buildFirstTinyPaperOrderFinalSubmitApprovalLock(options = {}) {
  const env = options.env ?? process.env;
  const args = options.args ?? parseArgs(options.argv ?? []);
  const now = options.now ?? new Date();
  const runsDir = options.runsDir ?? "runs";

  const by = String(args.by ?? "").trim();
  const reason = String(args.reason ?? "").trim();
  const approvalPhrase = String(args.approval ?? args.phrase ?? "").trim();

  const requestedParams = canonicalParams({
    symbol: args.symbol,
    qty: args.qty,
    side: args.side,
    type: args.type,
    timeInForce: args.tif ?? args.timeInForce
  });

  const gateArgv = [
    `--symbol=${requestedParams.symbol}`,
    `--qty=${requestedParams.qty}`,
    `--side=${requestedParams.side}`,
    `--type=${requestedParams.type}`,
    `--tif=${requestedParams.timeInForce}`
  ];

  const gate = buildFirstTinyPaperOrderSubmitPreflightGate({
    env,
    argv: gateArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 15) blockers.push("final_submit_approval_reason_required");
  if (approvalPhrase !== REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE) {
    blockers.push("exact_final_submit_approval_phrase_required");
  }

  if (!requestedParams.symbol || !Number.isFinite(requestedParams.qty) || requestedParams.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }

  if (Number.isFinite(requestedParams.qty) && requestedParams.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }

  if (gate.ok !== true) blockers.push("submit_preflight_gate_not_ok");
  if (gate.readyForSeparateSubmitApproval !== true) blockers.push("submit_preflight_gate_not_clean");
  if ((gate.issueBlockers ?? []).length > 0) blockers.push("submit_preflight_issue_blockers_present");
  if (!(gate.gateBlockers ?? []).includes(FINAL_GATE_BLOCKER)) {
    blockers.push("final_submit_approval_required_blocker_missing");
  }

  if (gate.safety?.orderSubmitAttempted !== false) blockers.push("gate_order_submit_attempted");
  if (gate.safety?.orderSubmitted !== false) blockers.push("gate_order_submitted");
  if (gate.safety?.brokerContactAttempted !== false) blockers.push("gate_broker_contact_attempted");
  if (gate.safety?.accountMutationAttempted !== false) blockers.push("gate_account_mutation_attempted");

  const submitPathUnlocked = blockers.length === 0;

  return {
    ok: true,
    version: FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_LOCK_VERSION,
    ts: now.toISOString(),
    approvalScope: "first_tiny_paper_order_submit_path_unlock_only",
    status: submitPathUnlocked ? "unlocked_for_manual_submit_step_only" : "blocked",
    lockStatus: submitPathUnlocked ? "unlocked" : "locked",
    submitPathUnlocked,
    by: by || null,
    reason: reason || null,
    requiredApprovalPhrase: REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE,
    approvalPhraseMatched: approvalPhrase === REQUIRED_FIRST_TINY_PAPER_ORDER_FINAL_SUBMIT_APPROVAL_PHRASE,
    parameters: requestedParams,
    gate: {
      version: gate.version,
      status: gate.status,
      gateStatus: gate.gateStatus,
      readyForSeparateSubmitApproval: gate.readyForSeparateSubmitApproval,
      approvalRecordFound: gate.approval?.approvalRecordFound === true,
      approvalRecordFile: gate.approval?.approvalRecordFile ?? null,
      issueBlockers: gate.issueBlockers ?? [],
      gateBlockers: gate.gateBlockers ?? [],
      controlledPreflight: gate.controlledPreflight ?? null
    },
    safety: {
      paperOnly: true,
      dryRunOnly: true,
      unlockOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      automaticSubmitAllowed: false
    },
    blockers,
    nextRequiredAction: submitPathUnlocked
      ? "Manual submit-step construction can be prepared next. This lock does not contact broker and does not submit an order."
      : "Resolve blockers before the first tiny paper order submit path can be unlocked."
  };
}

export function writeFirstTinyPaperOrderFinalSubmitApprovalLockReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.submitPathUnlocked ? "unlocked" : "blocked";
  const file = join(runsDir, `first_tiny_paper_order_final_submit_approval_lock_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
