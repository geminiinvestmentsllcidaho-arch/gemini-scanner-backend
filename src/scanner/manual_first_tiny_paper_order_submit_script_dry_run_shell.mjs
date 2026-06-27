import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MANUAL_FIRST_TINY_PAPER_ORDER_SUBMIT_SCRIPT_DRY_RUN_SHELL_VERSION =
  "manual_first_tiny_paper_order_submit_script_dry_run_shell_v1";

const REQUIRED_LOCK_SCOPE = "first_tiny_paper_order_submit_path_unlock_only";

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

function latestUnlockedFinalLock(runsDir = "runs") {
  try {
    const files = readdirSync(runsDir)
      .filter((name) => name.startsWith("first_tiny_paper_order_final_submit_approval_lock_unlocked_"))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      const path = join(runsDir, file);
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (
          parsed?.submitPathUnlocked === true &&
          parsed?.lockStatus === "unlocked" &&
          parsed?.approvalScope === REQUIRED_LOCK_SCOPE
        ) {
          return { found: true, file: path, parsed };
        }
      } catch {}
    }
  } catch {}

  return { found: false, file: null, parsed: null };
}

function paramsMatch(a, b) {
  const aa = canonicalParams(a);
  const bb = canonicalParams(b);
  return (
    aa.symbol === bb.symbol &&
    aa.qty === bb.qty &&
    aa.side === bb.side &&
    aa.type === bb.type &&
    aa.timeInForce === bb.timeInForce
  );
}

export function buildManualFirstTinyPaperOrderSubmitScriptDryRunShell(options = {}) {
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

  const dryRun = boolArg(args["dry-run"] ?? args.dryRun, true);
  const paperOnly = boolArg(args["paper-only"] ?? args.paperOnly, false);
  const manualOnly = boolArg(args["manual-only"] ?? args.manualOnly, false);
  const noAutoSubmit = boolArg(args["no-auto-submit"] ?? args.noAutoSubmit, false);
  const executeRequested = boolArg(args.execute ?? args.submit ?? args["real-submit"], false);

  const lock = latestUnlockedFinalLock(runsDir);
  const blockers = [];

  if (!lock.found) blockers.push("unlocked_final_submit_approval_lock_missing");
  if (lock.found && !paramsMatch(params, lock.parsed?.parameters ?? {})) {
    blockers.push("final_lock_parameter_mismatch");
  }

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }

  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }

  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (dryRun !== true) blockers.push("dry_run_required");
  if (paperOnly !== true) blockers.push("paper_only_flag_required");
  if (manualOnly !== true) blockers.push("manual_only_flag_required");
  if (noAutoSubmit !== true) blockers.push("no_auto_submit_flag_required");
  if (executeRequested === true) blockers.push("execute_request_blocked_in_dry_run_shell");

  const readyForManualSubmitImplementation = blockers.length === 0;

  return {
    ok: true,
    version: MANUAL_FIRST_TINY_PAPER_ORDER_SUBMIT_SCRIPT_DRY_RUN_SHELL_VERSION,
    ts: now.toISOString(),
    status: readyForManualSubmitImplementation ? "dry_run_ready" : "blocked",
    readyForManualSubmitImplementation,
    brokerAdapterCallPlanned: false,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: params,
    flags: {
      dryRun,
      paperOnly,
      manualOnly,
      noAutoSubmit,
      executeRequested
    },
    finalLock: {
      found: lock.found,
      file: lock.file,
      lockStatus: lock.parsed?.lockStatus ?? null,
      submitPathUnlocked: lock.parsed?.submitPathUnlocked === true,
      approvalScope: lock.parsed?.approvalScope ?? null
    },
    dryRunOrderEnvelope: readyForManualSubmitImplementation
      ? {
          broker: "alpaca_paper",
          symbol: params.symbol,
          qty: params.qty,
          side: params.side,
          type: params.type,
          time_in_force: params.timeInForce,
          paperOnly: true,
          manualOnly: true,
          dryRunOnly: true,
          submitAttempted: false
        }
      : null,
    safety: {
      dryRunOnly: true,
      paperOnly: true,
      manualOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: readyForManualSubmitImplementation
      ? "Build a separate broker adapter call wrapper next. This shell still did not contact broker and did not submit an order."
      : "Resolve blockers before any manual submit implementation can be prepared."
  };
}

export function writeManualFirstTinyPaperOrderSubmitScriptDryRunShellReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.readyForManualSubmitImplementation ? "ready" : "blocked";
  const file = join(runsDir, `manual_first_tiny_paper_order_submit_script_dry_run_shell_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
