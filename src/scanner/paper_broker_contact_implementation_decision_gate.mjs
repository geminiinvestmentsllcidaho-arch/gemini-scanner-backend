import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE,
  buildManualFirstTinyPaperOrderOneShotSubmitExecutor
} from "./manual_first_tiny_paper_order_one_shot_submit_executor.mjs";

export const PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_GATE_VERSION =
  "paper_broker_contact_implementation_decision_gate_v1";

export const REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE =
  "I_APPROVE_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_REVIEW_ONLY";

function parseArgs(argv = []) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}

function boolArg(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
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

export function buildPaperBrokerContactImplementationDecisionGate(options = {}) {
  const args = options.args ?? parseArgs(options.argv ?? []);
  const now = options.now ?? new Date();
  const runsDir = options.runsDir ?? "runs";

  const params = canonicalParams({
    symbol: args.symbol,
    qty: args.qty,
    side: args.side,
    type: args.type,
    timeInForce: args.tif ?? args.timeInForce
  });

  const by = String(args.by ?? "").trim();
  const reason = String(args.reason ?? "").trim();
  const decisionApproval = String(args.decisionApproval ?? args["decision-approval"] ?? "").trim();

  const reviewOnly = boolArg(args["review-only"] ?? args.reviewOnly, false);
  const implementationDecisionOnly = boolArg(
    args["implementation-decision-only"] ?? args.implementationDecisionOnly,
    false
  );
  const noNetworkImplementation = boolArg(
    args["no-network-implementation"] ?? args.noNetworkImplementation,
    false
  );
  const noBrokerContactNow = boolArg(args["no-broker-contact-now"] ?? args.noBrokerContactNow, false);

  const executorArgv = [
    `--by=${by}`,
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--one-shot=true",
    "--paper-only=true",
    "--manual-only=true",
    "--final-arm-only=true",
    "--allow-broker-contact-attempt=true",
    `--executor-approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE}`,
    `--reason=${reason || "One shot executor shell approval for first tiny paper order only"}`
  ];

  const executor = buildManualFirstTinyPaperOrderOneShotSubmitExecutor({
    argv: executorArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (executor.ok !== true) blockers.push("one_shot_executor_not_ok");
  if (executor.executorArmedForManualBrokerContactAttempt !== true) {
    blockers.push("one_shot_executor_not_armed");
  }
  if ((executor.blockers ?? []).length > 0) {
    blockers.push("one_shot_executor_blockers_present");
  }

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 30) blockers.push("implementation_decision_reason_required");
  if (decisionApproval !== REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE) {
    blockers.push("exact_implementation_decision_phrase_required");
  }

  if (reviewOnly !== true) blockers.push("review_only_flag_required");
  if (implementationDecisionOnly !== true) blockers.push("implementation_decision_only_flag_required");
  if (noNetworkImplementation !== true) blockers.push("no_network_implementation_flag_required");
  if (noBrokerContactNow !== true) blockers.push("no_broker_contact_now_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (executor.safety?.endpointImplemented !== false) blockers.push("executor_endpoint_implemented");
  if (executor.safety?.networkCallImplemented !== false) blockers.push("executor_network_call_implemented");
  if (executor.brokerAdapterCallAttempted !== false) blockers.push("executor_broker_adapter_call_attempted");
  if (executor.brokerContactAttempted !== false) blockers.push("executor_broker_contact_attempted");
  if (executor.orderSubmitAttempted !== false) blockers.push("executor_order_submit_attempted");
  if (executor.orderSubmitted !== false) blockers.push("executor_order_submitted");
  if (executor.accountMutationAttempted !== false) blockers.push("executor_account_mutation_attempted");

  const readyForSeparateImplementationStage = blockers.length === 0;

  return {
    ok: true,
    version: PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_GATE_VERSION,
    ts: now.toISOString(),
    status: readyForSeparateImplementationStage
      ? "ready_for_separate_network_implementation_stage"
      : "blocked",
    readyForSeparateImplementationStage,
    implementationApprovedNow: false,
    implementationDecisionOnly: true,
    networkImplementationIncluded: false,
    networkCallImplemented: false,
    endpointImplemented: false,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: params,
    approval: {
      by: by || null,
      reason: reason || null,
      requiredDecisionApprovalPhrase: REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE,
      decisionApprovalPhraseMatched:
        decisionApproval === REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE
    },
    flags: {
      reviewOnly,
      implementationDecisionOnly,
      noNetworkImplementation,
      noBrokerContactNow
    },
    executor: {
      version: executor.version,
      status: executor.status,
      executorArmedForManualBrokerContactAttempt:
        executor.executorArmedForManualBrokerContactAttempt,
      executorEnvelope: executor.executorEnvelope,
      safety: executor.safety,
      blockers: executor.blockers ?? []
    },
    decision: {
      canProceedToSeparateImplementationStage: readyForSeparateImplementationStage,
      requiresNewPatch: true,
      requiresNewExplicitBoracApproval: true,
      mustRemainPaperOnly: true,
      mustRemainOneShotOnly: true,
      mustRemainManualOnly: true,
      mustUseAdapterOnly: true,
      mustWriteAuditBeforeAndAfterAttempt: true,
      mustStopAfterSingleAttempt: true
    },
    safety: {
      decisionGateOnly: true,
      reviewOnly: true,
      shellOnly: true,
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      implementationApprovedNow: false,
      networkImplementationIncluded: false,
      endpointImplemented: false,
      networkCallImplemented: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: readyForSeparateImplementationStage
      ? "Create a new separately approved patch for the real paper broker contact implementation. This decision gate did not implement network contact."
      : "Resolve blockers before preparing a separate paper broker contact implementation patch."
  };
}

export function writePaperBrokerContactImplementationDecisionGateReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.readyForSeparateImplementationStage ? "ready" : "blocked";
  const file = join(runsDir, `paper_broker_contact_implementation_decision_gate_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
