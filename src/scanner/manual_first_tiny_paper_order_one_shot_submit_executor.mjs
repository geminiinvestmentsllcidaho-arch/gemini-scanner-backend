import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE,
  buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper
} from "./manual_first_tiny_paper_order_broker_adapter_call_wrapper.mjs";

export const MANUAL_FIRST_TINY_PAPER_ORDER_ONE_SHOT_SUBMIT_EXECUTOR_VERSION =
  "manual_first_tiny_paper_order_one_shot_submit_executor_v1";

export const REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE =
  "I_APPROVE_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_ARM_ONLY";

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

function makeExecutorEnvelope(params, wrapper) {
  const p = canonicalParams(params);

  return {
    executorMode: "one_shot_manual_paper_only",
    adapter: "alpaca_paper",
    operation: "manual_paper_order_attempt_preview_only",
    oneShotOnly: true,
    paperOnly: true,
    manualOnly: true,
    firstTinyPaperOrderOnly: true,
    endpointImplemented: false,
    networkCallImplemented: false,
    payloadPreview: {
      symbol: p.symbol,
      qty: String(p.qty),
      side: p.side,
      type: p.type,
      time_in_force: p.timeInForce
    },
    wrapperStatus: wrapper.status,
    execution: {
      armed: true,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    }
  };
}

export function buildManualFirstTinyPaperOrderOneShotSubmitExecutor(options = {}) {
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
  const executorApprovalPhrase = String(args.executorApproval ?? args["executor-approval"] ?? "").trim();

  const oneShot = boolArg(args["one-shot"] ?? args.oneShot, false);
  const paperOnly = boolArg(args["paper-only"] ?? args.paperOnly, false);
  const manualOnly = boolArg(args["manual-only"] ?? args.manualOnly, false);
  const finalArmOnly = boolArg(args["final-arm-only"] ?? args.finalArmOnly, false);
  const allowBrokerContactAttempt = boolArg(
    args["allow-broker-contact-attempt"] ?? args.allowBrokerContactAttempt,
    false
  );

  const wrapperArgv = [
    `--by=${by}`,
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--actual-paper-submit-approval=true",
    `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE}`,
    `--reason=${reason || "Actual paper broker contact attempt approval for first tiny paper order only"}`
  ];

  const wrapper = buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper({
    argv: wrapperArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (wrapper.ok !== true) blockers.push("broker_adapter_wrapper_not_ok");
  if (wrapper.brokerAdapterEnvelopeReady !== true) blockers.push("broker_adapter_wrapper_not_ready");
  if ((wrapper.blockers ?? []).length > 0) blockers.push("broker_adapter_wrapper_blockers_present");

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 25) blockers.push("one_shot_executor_reason_required");
  if (executorApprovalPhrase !== REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE) {
    blockers.push("exact_one_shot_executor_approval_phrase_required");
  }

  if (oneShot !== true) blockers.push("one_shot_flag_required");
  if (paperOnly !== true) blockers.push("paper_only_flag_required");
  if (manualOnly !== true) blockers.push("manual_only_flag_required");
  if (finalArmOnly !== true) blockers.push("final_arm_only_flag_required");
  if (allowBrokerContactAttempt !== true) blockers.push("allow_broker_contact_attempt_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (wrapper.brokerAdapterCallAttempted !== false) blockers.push("wrapper_broker_adapter_call_attempted");
  if (wrapper.brokerContactAttempted !== false) blockers.push("wrapper_broker_contact_attempted");
  if (wrapper.orderSubmitAttempted !== false) blockers.push("wrapper_order_submit_attempted");
  if (wrapper.orderSubmitted !== false) blockers.push("wrapper_order_submitted");
  if (wrapper.accountMutationAttempted !== false) blockers.push("wrapper_account_mutation_attempted");

  const executorArmedForManualBrokerContactAttempt = blockers.length === 0;

  return {
    ok: true,
    version: MANUAL_FIRST_TINY_PAPER_ORDER_ONE_SHOT_SUBMIT_EXECUTOR_VERSION,
    ts: now.toISOString(),
    status: executorArmedForManualBrokerContactAttempt
      ? "armed_for_manual_broker_contact_attempt_shell_only"
      : "blocked",
    executorArmedForManualBrokerContactAttempt,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: params,
    approval: {
      by: by || null,
      reason: reason || null,
      requiredExecutorApprovalPhrase: REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE,
      executorApprovalPhraseMatched:
        executorApprovalPhrase === REQUIRED_FIRST_TINY_PAPER_ORDER_ONE_SHOT_EXECUTOR_PHRASE
    },
    flags: {
      oneShot,
      paperOnly,
      manualOnly,
      finalArmOnly,
      allowBrokerContactAttempt
    },
    wrapper: {
      version: wrapper.version,
      status: wrapper.status,
      brokerAdapterEnvelopeReady: wrapper.brokerAdapterEnvelopeReady,
      brokerContactPermittedForNextManualStep: wrapper.brokerContactPermittedForNextManualStep,
      session: wrapper.session,
      approval: wrapper.approval,
      blockers: wrapper.blockers ?? []
    },
    executorEnvelope: executorArmedForManualBrokerContactAttempt
      ? makeExecutorEnvelope(params, wrapper)
      : null,
    safety: {
      oneShotOnly: true,
      paperOnly: true,
      manualOnly: true,
      shellOnly: true,
      endpointImplemented: false,
      networkCallImplemented: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: executorArmedForManualBrokerContactAttempt
      ? "Executor shell is armed only. The actual network call remains unimplemented and must be added in a separate explicitly approved stage."
      : "Resolve blockers before arming the one-shot manual executor shell."
  };
}

export function writeManualFirstTinyPaperOrderOneShotSubmitExecutorReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.executorArmedForManualBrokerContactAttempt ? "armed" : "blocked";
  const file = join(runsDir, `manual_first_tiny_paper_order_one_shot_submit_executor_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
