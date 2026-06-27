import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildControlledFirstTinyPaperOrderPreflight } from "./controlled_first_tiny_paper_order_preflight.mjs";

export const FIRST_TINY_PAPER_ORDER_SUBMIT_PREFLIGHT_GATE_VERSION =
  "first_tiny_paper_order_submit_preflight_gate_v1";

const REQUIRED_APPROVAL_SCOPE = "first_tiny_paper_order_submit_preflight_only";
const FINAL_REQUIRED_BLOCKER = "separate_borac_submit_approval_required";
const ALLOWED_PREFLIGHT_BLOCKERS = new Set(["paper_order_submit_dry_run_only"]);

function parseArgs(argv = []) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}

function latestApprovedApprovalRecord(runsDir = "runs") {
  try {
    const files = readdirSync(runsDir)
      .filter((name) => name.startsWith("first_tiny_paper_order_approval_record_approved_"))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      const path = join(runsDir, file);
      try {
        const record = JSON.parse(readFileSync(path, "utf8"));
        if (record?.approved === true && record?.approvalScope === REQUIRED_APPROVAL_SCOPE) {
          return { found: true, file: path, record };
        }
      } catch {}
    }
  } catch {}

  return { found: false, file: null, record: null };
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

function approvalSafetyValid(record) {
  const safety = record?.safety ?? {};
  return (
    record?.approved === true &&
    record?.approvalStatus === "approved" &&
    record?.status === "approved" &&
    record?.approvalScope === REQUIRED_APPROVAL_SCOPE &&
    record?.approvalPhraseMatched === true &&
    safety.paperOnly === true &&
    safety.dryRunOnly === true &&
    safety.brokerContactAttempted === false &&
    safety.orderSubmitAttempted === false &&
    safety.orderSubmitted === false &&
    safety.liveTradingAllowed === false &&
    safety.autoTradingAllowed === false &&
    safety.accountMutationAllowed === false
  );
}

export function buildFirstTinyPaperOrderSubmitPreflightGate(options = {}) {
  const env = options.env ?? process.env;
  const args = options.args ?? parseArgs(options.argv ?? []);
  const now = options.now ?? new Date();
  const runsDir = options.runsDir ?? "runs";

  const approval = latestApprovedApprovalRecord(runsDir);
  const approvalParams = canonicalParams(approval.record?.parameters ?? {});
  const requestedParams = canonicalParams({
    symbol: args.symbol ?? approvalParams.symbol,
    qty: args.qty ?? approvalParams.qty,
    side: args.side ?? approvalParams.side,
    type: args.type ?? approvalParams.type,
    timeInForce: args.tif ?? args.timeInForce ?? approvalParams.timeInForce
  });

  const issueBlockers = [];

  if (!approval.found) issueBlockers.push("approved_first_tiny_paper_order_record_missing");
  if (approval.found && !approvalSafetyValid(approval.record)) {
    issueBlockers.push("approved_record_safety_invalid");
  }

  if (!requestedParams.symbol || !Number.isFinite(requestedParams.qty) || requestedParams.qty <= 0) {
    issueBlockers.push("tiny_order_parameters_required");
  }

  if (Number.isFinite(requestedParams.qty) && requestedParams.qty > 1) {
    issueBlockers.push("tiny_order_quantity_exceeds_one_share");
  }

  const mismatches = [];
  for (const key of ["symbol", "qty", "side", "type", "timeInForce"]) {
    if (!approval.found) continue;
    if (requestedParams[key] !== approvalParams[key]) {
      mismatches.push({ field: key, requested: requestedParams[key], approved: approvalParams[key] });
    }
  }

  if (mismatches.length) issueBlockers.push("approval_parameter_mismatch");

  const preflightArgv = [
    `--symbol=${requestedParams.symbol}`,
    `--qty=${requestedParams.qty}`,
    `--side=${requestedParams.side}`,
    `--type=${requestedParams.type}`,
    `--tif=${requestedParams.timeInForce}`
  ];

  const controlledPreflight = buildControlledFirstTinyPaperOrderPreflight({
    env,
    argv: preflightArgv,
    now,
    runsDir
  });

  const unexpectedPreflightBlockers = (controlledPreflight.blockers ?? []).filter(
    (blocker) => !ALLOWED_PREFLIGHT_BLOCKERS.has(blocker)
  );

  if (controlledPreflight.ok !== true) issueBlockers.push("controlled_preflight_not_ok");
  if (!controlledPreflight.orderPreview) issueBlockers.push("controlled_preflight_order_preview_missing");
  if (controlledPreflight.brokerContactAttempted !== false) issueBlockers.push("broker_contact_attempted");
  if (controlledPreflight.orderSubmitAttempted !== false) issueBlockers.push("order_submit_attempted");
  if (controlledPreflight.orderSubmitted !== false) issueBlockers.push("order_submitted");
  if (controlledPreflight.accountMutationAttempted !== false) issueBlockers.push("account_mutation_attempted");
  if (unexpectedPreflightBlockers.length) issueBlockers.push("controlled_preflight_gate_blocked");

  const readyForSeparateSubmitApproval = issueBlockers.length === 0;

  return {
    ok: true,
    version: FIRST_TINY_PAPER_ORDER_SUBMIT_PREFLIGHT_GATE_VERSION,
    ts: now.toISOString(),
    status: "blocked",
    gateStatus: "blocked",
    readyForSeparateSubmitApproval,
    finalRequiredBlocker: FINAL_REQUIRED_BLOCKER,
    approval: {
      approvalRecordFound: approval.found,
      approvalRecordFile: approval.file,
      approvalScope: approval.record?.approvalScope ?? null,
      approvalStatus: approval.record?.approvalStatus ?? null,
      approved: approval.record?.approved === true
    },
    parameters: requestedParams,
    approvalParameterMismatches: mismatches,
    controlledPreflight: {
      version: controlledPreflight.version,
      status: controlledPreflight.status,
      dryRunOnly: controlledPreflight.dryRunOnly,
      brokerContactAttempted: controlledPreflight.brokerContactAttempted,
      orderSubmitAttempted: controlledPreflight.orderSubmitAttempted,
      orderSubmitted: controlledPreflight.orderSubmitted,
      accountMutationAttempted: controlledPreflight.accountMutationAttempted,
      orderPreview: controlledPreflight.orderPreview,
      blockers: controlledPreflight.blockers,
      unexpectedBlockers: unexpectedPreflightBlockers
    },
    safety: {
      dryRunOnly: true,
      paperOnly: true,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      finalSubmitApprovalRequired: true
    },
    issueBlockers,
    gateBlockers: [...issueBlockers, FINAL_REQUIRED_BLOCKER],
    nextRequiredAction: readyForSeparateSubmitApproval
      ? "Separate explicit Borac submit approval is still required. No order has been submitted."
      : "Resolve issue blockers before requesting separate explicit Borac submit approval."
  };
}

export function writeFirstTinyPaperOrderSubmitPreflightGateReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const file = join(runsDir, `first_tiny_paper_order_submit_preflight_gate_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
