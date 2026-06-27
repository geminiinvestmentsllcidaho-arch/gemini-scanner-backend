import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildManualFirstTinyPaperOrderSubmitScriptDryRunShell } from "./manual_first_tiny_paper_order_submit_script_dry_run_shell.mjs";

export const MANUAL_FIRST_TINY_PAPER_ORDER_BROKER_ADAPTER_CALL_WRAPPER_VERSION =
  "manual_first_tiny_paper_order_broker_adapter_call_wrapper_v1";

export const REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE =
  "I_APPROVE_FIRST_TINY_PAPER_ORDER_ACTUAL_PAPER_BROKER_CONTACT_ATTEMPT";

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

function marketSessionSnapshot(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const minutes = hour * 60 + minute;
  const weekdayOpen = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  const regularSessionTime = weekdayOpen && minutes >= 570 && minutes < 960;

  return {
    timezone: "America/New_York",
    weekday,
    hour,
    minute,
    regularSessionTime,
    marketOpen: regularSessionTime,
    note: "Time-only regular-hours check; exchange holidays are not externally queried by this wrapper."
  };
}

function adapterEnvelope(params, approval) {
  const p = canonicalParams(params);

  return {
    adapter: "alpaca_paper",
    action: "paper_order_envelope_preview_only",
    brokerMode: "paper",
    manualOnly: true,
    firstTinyPaperOrderOnly: true,
    endpointShape: {
      method: "NOT_IMPLEMENTED",
      path: "ORDER_ROUTE_INTENTIONALLY_NOT_IMPLEMENTED"
    },
    payloadPreview: {
      symbol: p.symbol,
      qty: String(p.qty),
      side: p.side,
      type: p.type,
      time_in_force: p.timeInForce
    },
    approval: {
      by: approval.by,
      reason: approval.reason,
      phraseMatched: approval.phraseMatched,
      actualPaperSubmitApproval: approval.actualPaperSubmitApproval
    },
    execution: {
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false
    }
  };
}

export function buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper(options = {}) {
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
  const approvalPhrase = String(args.approval ?? args.phrase ?? "").trim();
  const actualPaperSubmitApproval = boolArg(
    args["actual-paper-submit-approval"] ?? args.actualPaperSubmitApproval,
    false
  );

  const session = marketSessionSnapshot(now);

  const shellArgv = [
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--dry-run=true",
    "--paper-only=true",
    "--manual-only=true",
    "--no-auto-submit=true"
  ];

  const dryRunShell = buildManualFirstTinyPaperOrderSubmitScriptDryRunShell({
    argv: shellArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (dryRunShell.ok !== true) blockers.push("dry_run_shell_not_ok");
  if (dryRunShell.readyForManualSubmitImplementation !== true) {
    blockers.push("dry_run_shell_not_ready");
  }
  if ((dryRunShell.blockers ?? []).length > 0) {
    blockers.push("dry_run_shell_blockers_present");
  }

  if (!session.marketOpen) blockers.push("market_open_required");
  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 20) blockers.push("actual_paper_submit_approval_reason_required");
  if (approvalPhrase !== REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE) {
    blockers.push("exact_actual_broker_contact_approval_phrase_required");
  }
  if (actualPaperSubmitApproval !== true) blockers.push("actual_paper_submit_approval_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }

  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (dryRunShell.brokerContactAttempted !== false) blockers.push("shell_broker_contact_attempted");
  if (dryRunShell.orderSubmitAttempted !== false) blockers.push("shell_order_submit_attempted");
  if (dryRunShell.orderSubmitted !== false) blockers.push("shell_order_submitted");
  if (dryRunShell.accountMutationAttempted !== false) blockers.push("shell_account_mutation_attempted");

  const brokerAdapterEnvelopeReady = blockers.length === 0;

  return {
    ok: true,
    version: MANUAL_FIRST_TINY_PAPER_ORDER_BROKER_ADAPTER_CALL_WRAPPER_VERSION,
    ts: now.toISOString(),
    status: brokerAdapterEnvelopeReady ? "broker_adapter_call_envelope_ready" : "blocked",
    brokerAdapterEnvelopeReady,
    brokerContactPermittedForNextManualStep: brokerAdapterEnvelopeReady,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: params,
    session,
    approval: {
      by: by || null,
      reason: reason || null,
      requiredApprovalPhrase: REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE,
      phraseMatched:
        approvalPhrase === REQUIRED_FIRST_TINY_PAPER_ORDER_ACTUAL_BROKER_CONTACT_APPROVAL_PHRASE,
      actualPaperSubmitApproval
    },
    dryRunShell: {
      version: dryRunShell.version,
      status: dryRunShell.status,
      readyForManualSubmitImplementation: dryRunShell.readyForManualSubmitImplementation,
      finalLock: dryRunShell.finalLock,
      blockers: dryRunShell.blockers ?? [],
      dryRunOrderEnvelope: dryRunShell.dryRunOrderEnvelope ?? null
    },
    brokerAdapterCallEnvelope: brokerAdapterEnvelopeReady
      ? adapterEnvelope(params, {
          by,
          reason,
          phraseMatched: true,
          actualPaperSubmitApproval
        })
      : null,
    safety: {
      paperOnly: true,
      manualOnly: true,
      wrapperOnly: true,
      brokerContactAllowedForNextManualStepOnly: brokerAdapterEnvelopeReady,
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
    nextRequiredAction: brokerAdapterEnvelopeReady
      ? "Build the one-shot manual broker submit executor next. This wrapper formed the envelope only and did not contact broker."
      : "Resolve blockers before the broker adapter call envelope can be used."
  };
}

export function writeManualFirstTinyPaperOrderBrokerAdapterCallWrapperReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.brokerAdapterEnvelopeReady ? "ready" : "blocked";
  const file = join(runsDir, `manual_first_tiny_paper_order_broker_adapter_call_wrapper_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
