import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE,
  buildPaperBrokerRuntimeEnvironmentPreflight
} from "./paper_broker_runtime_environment_preflight.mjs";

import {
  REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE
} from "./paper_broker_network_call_implementation_patch.mjs";

export const FINAL_ONE_SHOT_PAPER_BROKER_ATTEMPT_RUNBOOK_VERSION =
  "final_one_shot_paper_broker_attempt_runbook_v1";

export const REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE =
  "I_APPROVE_FINAL_ONE_SHOT_PAPER_BROKER_ATTEMPT_RUNBOOK_ONLY";

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

function buildPreflightCommand(params, reason) {
  return [
    "npm run preflight:paper-broker-runtime-env --",
    `--by=Borac`,
    `--symbol=${q(params.symbol)}`,
    `--qty=${q(params.qty)}`,
    `--side=${q(params.side)}`,
    `--type=${q(params.type)}`,
    `--tif=${q(params.timeInForce)}`,
    "--preflight-only=true",
    "--no-network-attempt=true",
    "--no-order-attempt=true",
    "--no-broker-contact=true",
    `--preflight-approval=${REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE}`,
    `--reason=${q(reason)}`
  ].join(" ");
}

function buildNetworkAttemptCommand(params, reason) {
  return [
    "npm run network:paper-broker-call --",
    `--by=Borac`,
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

export function buildFinalOneShotPaperBrokerAttemptRunbook(options = {}) {
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
  const runbookApproval = String(args.runbookApproval ?? args["runbook-approval"] ?? "").trim();

  const runbookOnly = boolArg(args["runbook-only"] ?? args.runbookOnly, false);
  const noNetworkNow = boolArg(args["no-network-now"] ?? args.noNetworkNow, false);
  const noOrderNow = boolArg(args["no-order-now"] ?? args.noOrderNow, false);
  const finalManualReview = boolArg(args["final-manual-review"] ?? args.finalManualReview, false);

  const preflightArgv = [
    `--by=${by}`,
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--preflight-only=true",
    "--no-network-attempt=true",
    "--no-order-attempt=true",
    "--no-broker-contact=true",
    `--preflight-approval=${REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE}`,
    `--reason=${reason || "Runtime environment preflight only before exactly one paper broker network call"}`
  ];

  const preflight = buildPaperBrokerRuntimeEnvironmentPreflight({
    env,
    argv: preflightArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (preflight.ok !== true) blockers.push("runtime_preflight_not_ok");
  if (preflight.runtimeEnvironmentReady !== true) blockers.push("runtime_preflight_not_ready");
  if ((preflight.blockers ?? []).length > 0) blockers.push("runtime_preflight_blockers_present");

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 45) blockers.push("final_runbook_reason_required");
  if (runbookApproval !== REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE) {
    blockers.push("exact_final_runbook_approval_phrase_required");
  }

  if (runbookOnly !== true) blockers.push("runbook_only_flag_required");
  if (noNetworkNow !== true) blockers.push("no_network_now_flag_required");
  if (noOrderNow !== true) blockers.push("no_order_now_flag_required");
  if (finalManualReview !== true) blockers.push("final_manual_review_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (preflight.networkAttempted !== false) blockers.push("preflight_network_attempted");
  if (preflight.brokerAdapterCallAttempted !== false) blockers.push("preflight_broker_adapter_call_attempted");
  if (preflight.brokerContactAttempted !== false) blockers.push("preflight_broker_contact_attempted");
  if (preflight.orderSubmitAttempted !== false) blockers.push("preflight_order_submit_attempted");
  if (preflight.orderSubmitted !== false) blockers.push("preflight_order_submitted");
  if (preflight.accountMutationAttempted !== false) blockers.push("preflight_account_mutation_attempted");

  const runbookReady = blockers.length === 0;
  const finalReason = reason || "Runtime approval for exactly one paper broker network call attempt only";

  return {
    ok: true,
    version: FINAL_ONE_SHOT_PAPER_BROKER_ATTEMPT_RUNBOOK_VERSION,
    ts: now.toISOString(),
    status: runbookReady ? "runbook_ready" : "blocked",
    runbookReady,
    runbookOnly: true,
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
      requiredRunbookApprovalPhrase: REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE,
      runbookApprovalPhraseMatched:
        runbookApproval === REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE
    },
    flags: {
      runbookOnly,
      noNetworkNow,
      noOrderNow,
      finalManualReview
    },
    runtimePreflight: {
      version: preflight.version,
      status: preflight.status,
      runtimeEnvironmentReady: preflight.runtimeEnvironmentReady,
      implementationReadiness: preflight.implementationReadiness,
      environment: preflight.environment,
      blockers: preflight.blockers ?? []
    },
    commandSequence: runbookReady
      ? [
          {
            step: 1,
            name: "Confirm clean repo and latest safety validation",
            command: "git status && npm run validate:trading-safety && npm run validate:all"
          },
          {
            step: 2,
            name: "Confirm runtime environment preflight without broker contact",
            command: buildPreflightCommand(params, finalReason)
          },
          {
            step: 3,
            name: "Run exactly one manual paper broker network attempt",
            command: buildNetworkAttemptCommand(params, finalReason)
          },
          {
            step: 4,
            name: "Inspect latest pre-attempt and post-attempt audit files",
            command:
              "ls -1t runs/paper_broker_network_call_pre_attempt_*.json runs/paper_broker_network_call_post_attempt_*.json 2>/dev/null | head -10"
          }
        ]
      : [],
    stopRules: [
      "Stop if market_open_required appears.",
      "Stop if any environment variable is missing.",
      "Stop if any approval record is missing or blocked.",
      "Stop if prior_one_shot_attempt_already_recorded appears.",
      "Stop after the first network attempt result, regardless of success or failure.",
      "Do not retry without creating a new approval chain."
    ],
    safety: {
      runbookOnly: true,
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      networkAttempted: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: runbookReady
      ? "Run the command sequence manually during market hours only. This runbook did not contact broker."
      : "Resolve blockers before using the final one-shot paper broker attempt runbook."
  };
}

export function writeFinalOneShotPaperBrokerAttemptRunbookReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.runbookReady ? "ready" : "blocked";
  const file = join(runsDir, `final_one_shot_paper_broker_attempt_runbook_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
