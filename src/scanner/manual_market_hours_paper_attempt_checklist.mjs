import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE,
  buildFinalOneShotPaperBrokerAttemptRunbook
} from "./final_one_shot_paper_broker_attempt_runbook.mjs";

export const MANUAL_MARKET_HOURS_PAPER_ATTEMPT_CHECKLIST_VERSION =
  "manual_market_hours_paper_attempt_checklist_v1";

export const REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE =
  "I_APPROVE_MANUAL_MARKET_HOURS_PAPER_ATTEMPT_CHECKLIST_ONLY";

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

function envCheckCommand() {
  return [
    "node - <<'NODE'",
    "const required=['ALPACA_PAPER_TRADING_BASE_URL','ALPACA_PAPER_ORDER_CREATE_PATH','ALPACA_API_KEY_ID','ALPACA_API_SECRET_KEY'];",
    "const out=Object.fromEntries(required.map(k=>[k,Boolean(process.env[k])]));",
    "console.log(JSON.stringify({ok:Object.values(out).every(Boolean),envPresent:out,secretsRedacted:true},null,2));",
    "NODE"
  ].join("\n");
}

export function buildManualMarketHoursPaperAttemptChecklist(options = {}) {
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
  const checklistApproval = String(args.checklistApproval ?? args["checklist-approval"] ?? "").trim();

  const checklistOnly = boolArg(args["checklist-only"] ?? args.checklistOnly, false);
  const preflightOnly = boolArg(args["preflight-only"] ?? args.preflightOnly, false);
  const noNetworkNow = boolArg(args["no-network-now"] ?? args.noNetworkNow, false);
  const noOrderNow = boolArg(args["no-order-now"] ?? args.noOrderNow, false);
  const boracFinalDecisionRequired = boolArg(
    args["borac-final-decision-required"] ?? args.boracFinalDecisionRequired,
    false
  );

  const runbookArgv = [
    `--by=${by}`,
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--runbook-only=true",
    "--no-network-now=true",
    "--no-order-now=true",
    "--final-manual-review=true",
    `--runbook-approval=${REQUIRED_FINAL_ONE_SHOT_RUNBOOK_APPROVAL_PHRASE}`,
    `--reason=${reason || "Final runbook only before exactly one paper broker network call attempt"}`
  ];

  const runbook = buildFinalOneShotPaperBrokerAttemptRunbook({
    env,
    argv: runbookArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (runbook.ok !== true) blockers.push("final_runbook_not_ok");
  if (runbook.runbookReady !== true) blockers.push("final_runbook_not_ready");
  if ((runbook.blockers ?? []).length > 0) blockers.push("final_runbook_blockers_present");

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 45) blockers.push("manual_checklist_reason_required");
  if (checklistApproval !== REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE) {
    blockers.push("exact_manual_checklist_approval_phrase_required");
  }

  if (checklistOnly !== true) blockers.push("checklist_only_flag_required");
  if (preflightOnly !== true) blockers.push("preflight_only_flag_required");
  if (noNetworkNow !== true) blockers.push("no_network_now_flag_required");
  if (noOrderNow !== true) blockers.push("no_order_now_flag_required");
  if (boracFinalDecisionRequired !== true) blockers.push("borac_final_decision_required_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (runbook.networkAttempted !== false) blockers.push("runbook_network_attempted");
  if (runbook.brokerAdapterCallAttempted !== false) blockers.push("runbook_broker_adapter_call_attempted");
  if (runbook.brokerContactAttempted !== false) blockers.push("runbook_broker_contact_attempted");
  if (runbook.orderSubmitAttempted !== false) blockers.push("runbook_order_submit_attempted");
  if (runbook.orderSubmitted !== false) blockers.push("runbook_order_submitted");
  if (runbook.accountMutationAttempted !== false) blockers.push("runbook_account_mutation_attempted");

  const checklistReady = blockers.length === 0;
  const runbookCommands = Array.isArray(runbook.commandSequence) ? runbook.commandSequence : [];
  const preflightCommand = runbookCommands.find((item) => item.name?.includes("preflight"))?.command ?? null;

  return {
    ok: true,
    version: MANUAL_MARKET_HOURS_PAPER_ATTEMPT_CHECKLIST_VERSION,
    ts: now.toISOString(),
    status: checklistReady ? "checklist_ready" : "blocked",
    checklistReady,
    checklistOnly: true,
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
      requiredChecklistApprovalPhrase: REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE,
      checklistApprovalPhraseMatched:
        checklistApproval === REQUIRED_MANUAL_MARKET_HOURS_CHECKLIST_APPROVAL_PHRASE
    },
    flags: {
      checklistOnly,
      preflightOnly,
      noNetworkNow,
      noOrderNow,
      boracFinalDecisionRequired
    },
    runbook: {
      version: runbook.version,
      status: runbook.status,
      runbookReady: runbook.runbookReady,
      runtimePreflight: runbook.runtimePreflight,
      stopRules: runbook.stopRules,
      blockers: runbook.blockers ?? []
    },
    checklistCommands: checklistReady
      ? [
          {
            step: 1,
            name: "Verify repo and safety validations",
            command: "git status && npm run validate:trading-safety && npm run validate:all"
          },
          {
            step: 2,
            name: "Verify required runtime env is present without printing secrets",
            command: envCheckCommand()
          },
          {
            step: 3,
            name: "Run runtime preflight only; no broker contact",
            command: preflightCommand
          },
          {
            step: 4,
            name: "Stop for Borac final decision",
            command:
              "echo \"STOP: checklist complete. Do not run the network attempt unless Borac explicitly approves the final one-shot paper broker command.\""
          }
        ]
      : [],
    finalNetworkCommandIncluded: false,
    finalNetworkCommandWithheld: true,
    finalDecisionRequired:
      "Borac must separately decide whether to run the one-shot network command after checklist and preflight pass.",
    safety: {
      checklistOnly: true,
      preflightOnly: true,
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      finalNetworkCommandIncluded: false,
      networkAttempted: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: checklistReady
      ? "Run checklist commands only during market hours. Stop after checklist; Borac decides whether to run the final one-shot paper broker command."
      : "Resolve blockers before running the market-hours checklist."
  };
}

export function writeManualMarketHoursPaperAttemptChecklistReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.checklistReady ? "ready" : "blocked";
  const file = join(runsDir, `manual_market_hours_paper_attempt_checklist_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
