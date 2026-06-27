import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildFirstTinyPaperOrderFinalSubmitApprovalLock } from "./first_tiny_paper_order_final_submit_approval_lock.mjs";

export const MANUAL_FIRST_TINY_PAPER_ORDER_SUBMIT_COMMAND_BUILDER_VERSION =
  "manual_first_tiny_paper_order_submit_command_builder_v1";

function parseArgs(argv = []) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}

function shellQuote(value) {
  const s = String(value ?? "");
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
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

function buildManualCommand(params) {
  const p = canonicalParams(params);
  return [
    "npm",
    "run",
    "submit:first-tiny-paper-order-manual",
    "--",
    `--symbol=${shellQuote(p.symbol)}`,
    `--qty=${shellQuote(p.qty)}`,
    `--side=${shellQuote(p.side)}`,
    `--type=${shellQuote(p.type)}`,
    `--tif=${shellQuote(p.timeInForce)}`,
    "--paper-only=true",
    "--manual-only=true",
    "--no-auto-submit=true"
  ].join(" ");
}

export function buildManualFirstTinyPaperOrderSubmitCommandBuilder(options = {}) {
  const env = options.env ?? process.env;
  const args = options.args ?? parseArgs(options.argv ?? []);
  const now = options.now ?? new Date();
  const runsDir = options.runsDir ?? "runs";

  const lock = buildFirstTinyPaperOrderFinalSubmitApprovalLock({
    env,
    argv: options.argv ?? [],
    args,
    now,
    runsDir
  });

  const params = canonicalParams(lock.parameters ?? args);
  const blockers = [];

  if (lock.ok !== true) blockers.push("final_submit_lock_not_ok");
  if (lock.submitPathUnlocked !== true) blockers.push("final_submit_lock_not_unlocked");
  if (lock.lockStatus !== "unlocked") blockers.push("final_submit_lock_status_not_unlocked");
  if ((lock.blockers ?? []).length > 0) blockers.push("final_submit_lock_blockers_present");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }

  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }

  if (lock.safety?.brokerContactAttempted !== false) blockers.push("lock_broker_contact_attempted");
  if (lock.safety?.orderSubmitAttempted !== false) blockers.push("lock_order_submit_attempted");
  if (lock.safety?.orderSubmitted !== false) blockers.push("lock_order_submitted");
  if (lock.safety?.accountMutationAttempted !== false) blockers.push("lock_account_mutation_attempted");

  const commandPreviewAllowed = blockers.length === 0;

  return {
    ok: true,
    version: MANUAL_FIRST_TINY_PAPER_ORDER_SUBMIT_COMMAND_BUILDER_VERSION,
    ts: now.toISOString(),
    status: commandPreviewAllowed ? "command_preview_ready" : "blocked",
    commandPreviewAllowed,
    commandPreview: commandPreviewAllowed ? buildManualCommand(params) : null,
    commandDoesNotExistYet: true,
    commandPurpose:
      "Preview the exact manual-only first tiny paper order submit command. This builder does not run the command.",
    parameters: params,
    lock: {
      version: lock.version,
      status: lock.status,
      lockStatus: lock.lockStatus,
      submitPathUnlocked: lock.submitPathUnlocked,
      blockers: lock.blockers ?? [],
      gate: lock.gate ?? null
    },
    safety: {
      paperOnly: true,
      manualOnly: true,
      previewOnly: true,
      dryRunOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      commandExecuted: false
    },
    blockers,
    nextRequiredAction: commandPreviewAllowed
      ? "Build the manual submit script next. Do not run the previewed command until Borac explicitly approves the actual submit step."
      : "Unlock the final submit approval lock before showing the manual submit command preview."
  };
}

export function writeManualFirstTinyPaperOrderSubmitCommandBuilderReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.commandPreviewAllowed ? "ready" : "blocked";
  const file = join(runsDir, `manual_first_tiny_paper_order_submit_command_builder_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
