import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE,
  buildPaperBrokerContactImplementationDecisionGate
} from "./paper_broker_contact_implementation_decision_gate.mjs";

export const SEPARATE_EXPLICIT_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_VERSION =
  "separate_explicit_paper_broker_network_implementation_approval_v1";

export const REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE =
  "I_APPROVE_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_PATCH_ONLY";

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

export function buildSeparateExplicitPaperBrokerNetworkImplementationApproval(options = {}) {
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

  const approvalRecordOnly = boolArg(args["approval-record-only"] ?? args.approvalRecordOnly, false);
  const separatePatchOnly = boolArg(args["separate-patch-only"] ?? args.separatePatchOnly, false);
  const noNetworkCodeNow = boolArg(args["no-network-code-now"] ?? args.noNetworkCodeNow, false);
  const noBrokerContactNow = boolArg(args["no-broker-contact-now"] ?? args.noBrokerContactNow, false);
  const noOrderAttemptNow = boolArg(args["no-order-attempt-now"] ?? args.noOrderAttemptNow, false);

  const decisionArgv = [
    `--by=${by}`,
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--review-only=true",
    "--implementation-decision-only=true",
    "--no-network-implementation=true",
    "--no-broker-contact-now=true",
    `--decision-approval=${REQUIRED_PAPER_BROKER_CONTACT_IMPLEMENTATION_DECISION_PHRASE}`,
    `--reason=${reason || "Decision review only for separate paper broker contact implementation stage"}`
  ];

  const decisionGate = buildPaperBrokerContactImplementationDecisionGate({
    argv: decisionArgv,
    now,
    runsDir
  });

  const blockers = [];

  if (decisionGate.ok !== true) blockers.push("decision_gate_not_ok");
  if (decisionGate.readyForSeparateImplementationStage !== true) {
    blockers.push("decision_gate_not_ready_for_separate_implementation_stage");
  }
  if ((decisionGate.blockers ?? []).length > 0) {
    blockers.push("decision_gate_blockers_present");
  }

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 35) blockers.push("implementation_approval_reason_required");
  if (approvalPhrase !== REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE) {
    blockers.push("exact_network_implementation_approval_phrase_required");
  }

  if (approvalRecordOnly !== true) blockers.push("approval_record_only_flag_required");
  if (separatePatchOnly !== true) blockers.push("separate_patch_only_flag_required");
  if (noNetworkCodeNow !== true) blockers.push("no_network_code_now_flag_required");
  if (noBrokerContactNow !== true) blockers.push("no_broker_contact_now_flag_required");
  if (noOrderAttemptNow !== true) blockers.push("no_order_attempt_now_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (decisionGate.networkImplementationIncluded !== false) blockers.push("decision_gate_network_implementation_included");
  if (decisionGate.networkCallImplemented !== false) blockers.push("decision_gate_network_call_implemented");
  if (decisionGate.endpointImplemented !== false) blockers.push("decision_gate_endpoint_implemented");
  if (decisionGate.brokerAdapterCallAttempted !== false) blockers.push("decision_gate_broker_adapter_call_attempted");
  if (decisionGate.brokerContactAttempted !== false) blockers.push("decision_gate_broker_contact_attempted");
  if (decisionGate.orderSubmitAttempted !== false) blockers.push("decision_gate_order_submit_attempted");
  if (decisionGate.orderSubmitted !== false) blockers.push("decision_gate_order_submitted");
  if (decisionGate.accountMutationAttempted !== false) blockers.push("decision_gate_account_mutation_attempted");

  const approvalGrantedForSeparatePatchOnly = blockers.length === 0;

  return {
    ok: true,
    version: SEPARATE_EXPLICIT_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_VERSION,
    ts: now.toISOString(),
    approvalScope: "separate_paper_broker_network_implementation_patch_only",
    status: approvalGrantedForSeparatePatchOnly ? "approved_for_separate_patch_only" : "blocked",
    approvalGrantedForSeparatePatchOnly,
    implementationIncluded: false,
    networkCodeIncludedNow: false,
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
      requiredApprovalPhrase: REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE,
      approvalPhraseMatched:
        approvalPhrase === REQUIRED_SEPARATE_PAPER_BROKER_NETWORK_IMPLEMENTATION_APPROVAL_PHRASE
    },
    flags: {
      approvalRecordOnly,
      separatePatchOnly,
      noNetworkCodeNow,
      noBrokerContactNow,
      noOrderAttemptNow
    },
    decisionGate: {
      version: decisionGate.version,
      status: decisionGate.status,
      readyForSeparateImplementationStage: decisionGate.readyForSeparateImplementationStage,
      implementationApprovedNow: decisionGate.implementationApprovedNow,
      networkImplementationIncluded: decisionGate.networkImplementationIncluded,
      networkCallImplemented: decisionGate.networkCallImplemented,
      endpointImplemented: decisionGate.endpointImplemented,
      decision: decisionGate.decision,
      blockers: decisionGate.blockers ?? []
    },
    nextPatchContract: approvalGrantedForSeparatePatchOnly
      ? {
          mayAddNetworkCodeInSeparatePatch: true,
          mustRemainPaperOnly: true,
          mustRemainManualOnly: true,
          mustRemainOneShotOnly: true,
          mustRequireFreshBoracApprovalAtRuntime: true,
          mustWritePreAttemptAudit: true,
          mustWritePostAttemptAudit: true,
          mustStopAfterSingleAttempt: true,
          mustKeepLiveTradingDisabled: true,
          mustKeepAutoTradingDisabled: true
        }
      : null,
    safety: {
      approvalRecordOnly: true,
      separatePatchOnly: true,
      implementationIncluded: false,
      networkCodeIncludedNow: false,
      networkCallImplemented: false,
      endpointImplemented: false,
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
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
    nextRequiredAction: approvalGrantedForSeparatePatchOnly
      ? "A separate implementation patch may be prepared next. This approval record still included no network code and made no broker contact."
      : "Resolve blockers before approving a separate implementation patch."
  };
}

export function writeSeparateExplicitPaperBrokerNetworkImplementationApprovalReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.approvalGrantedForSeparatePatchOnly ? "approved" : "blocked";
  const file = join(runsDir, `separate_explicit_paper_broker_network_implementation_approval_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
