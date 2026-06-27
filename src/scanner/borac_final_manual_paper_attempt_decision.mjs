import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE,
  buildManualMarketHoursPaperAttemptChecklist
} from "./manual_market_hours_paper_attempt_checklist.mjs";

import {
  REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE
} from "./paper_broker_network_call_implementation_patch.mjs";

export const BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_VERSION =
  "borac_final_manual_paper_attempt_decision_v1";

export const REQUIRED_BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_PHRASE =
  "I_APPROVE_SHOW_FINAL_ONE_SHOT_PAPER_BROKER_COMMAND_ONLY";

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

function q(value) {
  const s = String(value ?? "");
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(s)) return s;
  return `"${s.replace(/(["\\$`])/g, "\\$1")}"`;
}

function buildFinalNetworkCommand(params, reason) {
  return [
    "npm run network:paper-broker-call --",
    "--by=Borac",
    `--symbol=${q(params.symbol)}`,
    `--qty=${q(params.qty)}`,
    `--side=${q(params.side)}`,
    `--type=${q(params.type)}`,
    `--tif=${q(params.timeInForce)}`,
    "--execute-network=true",
    "--one-shot=true",
    "--paper-only=true",
    "--manual-only=true",
    "--write-audit=true",
    "--stop-after-single-attempt=true",
    `--runtime-approval=${REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE}`,
    `--reason=${q(reason)}`
  ].join(" ");
}

export function buildBoracFinalManualPaperAttemptDecision(options = {}) {
  const env = options.env ?? process.env;
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
  const finalDecisionApproval = String(
    args.finalDecisionApproval ?? args["final-decision-approval"] ?? ""
  ).trim();

  const decisionOnly = boolArg(args["decision-only"] ?? args.decisionOnly, false);
  const showCommandOnly = boolArg(args["show-command-only"] ?? args.showCommandOnly, false);
  const manualExecutionOnly = boolArg(args["manual-execution-only"] ?? args.manualExecutionOnly, false);
  const noAutoRun = boolArg(args["no-auto-run"] ?? args.noAutoRun, false);
  const boracAcceptsRisk = boolArg(args["borac-accepts-paper-risk"] ?? args.boracAcceptsRisk, false);

  const checklistArgv = [
    `--by=${by}`,
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--checklist-only=true",
    "--preflight-only=true",
    "--no-network-now=true",
    "--no-order-now=true",
    "--borac-final-decision-required=true",
    `--checklist-approval=${REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE}`,
    `--reason=${reason || "Manual market hours checklist only before exactly one paper broker network call attempt"}`
  ];

  const checklist = buildManualMarketHoursPaperAttemptChecklist({
    env,
    argv: checklistArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (checklist.ok !== true) blockers.push("manual_market_hours_checklist_not_ok");
  if (checklist.checklistReady !== true) blockers.push("manual_market_hours_checklist_not_ready");
  if ((checklist.blockers ?? []).length > 0) blockers.push("manual_market_hours_checklist_blockers_present");

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 50) blockers.push("final_decision_reason_required");
  if (finalDecisionApproval !== REQUIRED_BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_PHRASE) {
    blockers.push("exact_final_decision_approval_phrase_required");
  }

  if (decisionOnly !== true) blockers.push("decision_only_flag_required");
  if (showCommandOnly !== true) blockers.push("show_command_only_flag_required");
  if (manualExecutionOnly !== true) blockers.push("manual_execution_only_flag_required");
  if (noAutoRun !== true) blockers.push("no_auto_run_flag_required");
  if (boracAcceptsRisk !== true) blockers.push("borac_accepts_paper_risk_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (checklist.networkAttempted !== false) blockers.push("checklist_network_attempted");
  if (checklist.brokerAdapterCallAttempted !== false) blockers.push("checklist_broker_adapter_call_attempted");
  if (checklist.brokerContactAttempted !== false) blockers.push("checklist_broker_contact_attempted");
  if (checklist.orderSubmitAttempted !== false) blockers.push("checklist_order_submit_attempted");
  if (checklist.orderSubmitted !== false) blockers.push("checklist_order_submitted");
  if (checklist.accountMutationAttempted !== false) blockers.push("checklist_account_mutation_attempted");

  const finalCommandVisible = blockers.length === 0;
  const finalReason =
    reason || "Runtime approval for exactly one paper broker network call attempt only";

  return {
    ok: true,
    version: BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_VERSION,
    ts: now.toISOString(),
    status: finalCommandVisible ? "final_command_visible_for_manual_copy_only" : "blocked",
    finalCommandVisible,
    decisionOnly: true,
    commandDisplayedOnly: finalCommandVisible,
    commandAutoExecuted: false,
    networkAttempted: false,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: params,
    approval: {
      by: by || null,
      reason: reason || null,
      requiredFinalDecisionApprovalPhrase:
        REQUIRED_BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_PHRASE,
      finalDecisionApprovalPhraseMatched:
        finalDecisionApproval === REQUIRED_BORAC_FINAL_MANUAL_PAPER_ATTEMPT_DECISION_PHRASE,
      boracAcceptsRisk
    },
    flags: {
      decisionOnly,
      showCommandOnly,
      manualExecutionOnly,
      noAutoRun,
      boracAcceptsRisk
    },
    checklist: {
      version: checklist.version,
      status: checklist.status,
      checklistReady: checklist.checklistReady,
      finalNetworkCommandIncluded: checklist.finalNetworkCommandIncluded,
      finalNetworkCommandWithheld: checklist.finalNetworkCommandWithheld,
      runtimePreflight: checklist.runbook?.runtimePreflight ?? null,
      blockers: checklist.blockers ?? []
    },
    finalManualCommand: finalCommandVisible
      ? buildFinalNetworkCommand(params, finalReason)
      : null,
    finalWarnings: [
      "This command may contact the Alpaca paper broker if copied and executed.",
      "Run only during regular market hours.",
      "Run only once.",
      "Do not retry without creating a new approval chain.",
      "This remains paper-only, manual-only, one-shot only.",
      "Stop immediately after the first success, failure, or error result."
    ],
    safety: {
      decisionOnly: true,
      showCommandOnly: true,
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      commandAutoExecuted: false,
      networkAttempted: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: finalCommandVisible
      ? "Borac may manually copy and run the final command once during market hours. This decision step did not execute it."
      : "Resolve blockers before displaying the final one-shot paper broker command."
  };
}

export function writeBoracFinalManualPaperAttemptDecisionReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.finalCommandVisible ? "visible" : "blocked";
  const file = join(runsDir, `borac_final_manual_paper_attempt_decision_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
