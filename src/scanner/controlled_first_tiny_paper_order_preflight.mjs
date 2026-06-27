import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const CONTROLLED_FIRST_TINY_PAPER_ORDER_PREFLIGHT_VERSION =
  "controlled_first_tiny_paper_order_preflight_v1";

function boolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on", "enabled", "allow", "allowed"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off", "disabled", "deny", "denied"].includes(normalized)) return false;
  return fallback;
}

function parseArgs(argv = []) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
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
    note: "Time-only regular-hours check; exchange holidays are not externally queried by this dry-run preflight."
  };
}

function latestApprovalRecord(runsDir = "runs") {
  try {
    const files = readdirSync(runsDir)
      .filter((name) => name.endsWith(".json"))
      .filter((name) => {
        const n = name.toLowerCase();
        return n.includes("approval") && (n.includes("broker") || n.includes("paper"));
      })
      .sort()
      .reverse();

    for (const file of files) {
      const path = join(runsDir, file);
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        return { found: true, file: path, parsed };
      } catch {
        return { found: true, file: path, parsed: null, parseError: true };
      }
    }
  } catch {}

  return { found: false, file: null, parsed: null };
}

function approvalLooksPassed(record, env) {
  if (boolEnv(env.BROKER_ADAPTER_APPROVAL_LOCK_PASSED, false)) return true;
  const p = record?.parsed;
  if (!p || typeof p !== "object") return false;

  return Boolean(
    p.passed === true ||
      p.approved === true ||
      p.approvalPassed === true ||
      p.approvalStatus === "approved" ||
      p.status === "approved" ||
      p.lockStatus === "passed" ||
      p.lockStatus === "unlocked"
  );
}

export function buildControlledFirstTinyPaperOrderPreflight(options = {}) {
  const env = options.env ?? process.env;
  const args = options.args ?? parseArgs(options.argv ?? []);
  const now = options.now ?? new Date();
  const runsDir = options.runsDir ?? "runs";

  const symbol = String(args.symbol ?? env.TINY_PAPER_ORDER_SYMBOL ?? "").trim().toUpperCase();
  const side = String(args.side ?? env.TINY_PAPER_ORDER_SIDE ?? "buy").trim().toLowerCase();
  const type = String(args.type ?? env.TINY_PAPER_ORDER_TYPE ?? "market").trim().toLowerCase();
  const timeInForce = String(args.tif ?? args.timeInForce ?? env.TINY_PAPER_ORDER_TIF ?? "day").trim().toLowerCase();
  const qtyRaw = String(args.qty ?? env.TINY_PAPER_ORDER_QTY ?? "").trim();
  const qty = Number(qtyRaw);
  const maxTinyQty = Number(env.TINY_PAPER_ORDER_MAX_QTY ?? "1");

  const safety = {
    brokerContactAllowed: boolEnv(env.BROKER_CONTACT_ALLOWED, false),
    orderPlacementAllowed: boolEnv(env.ORDER_PLACEMENT_ALLOWED, false),
    liveTradingAllowed: boolEnv(env.LIVE_TRADING_ALLOWED, false),
    autoTradingAllowed: boolEnv(env.AUTO_TRADING_ALLOWED, false),
    accountMutationAllowed: boolEnv(env.ACCOUNT_MUTATION_ALLOWED, false),
    brokerAdapterEnabled: boolEnv(env.BROKER_ADAPTER_ENABLED, false),
    brokerAdapterRequested: boolEnv(env.BROKER_ADAPTER_REQUESTED, false),
    paperTradingKillSwitchActive: boolEnv(
      env.PAPER_TRADING_KILL_SWITCH_ACTIVE ?? env.PAPER_TRADING_KILL_SWITCH,
      true
    ),
    paperOrderSubmitEnabled: boolEnv(env.PAPER_ORDER_SUBMIT_ENABLED, false)
  };

  const approvalRecord = latestApprovalRecord(runsDir);
  const approvalLockPassed = approvalLooksPassed(approvalRecord, env);
  const manualConfirmation = String(env.BORAC_TINY_PAPER_ORDER_PREFLIGHT_APPROVAL ?? "").trim();

  const session = marketSessionSnapshot(now);
  const blockers = [];
  const guards = ["dry_run_only", "no_broker_contact", "no_order_submission"];

  if (manualConfirmation !== "I_APPROVE_FIRST_TINY_PAPER_ORDER_PREFLIGHT") {
    blockers.push("manual_operator_confirmation_required");
  }

  if (!symbol || !Number.isFinite(qty) || qty <= 0 || !["buy", "sell"].includes(side)) {
    blockers.push("tiny_order_parameters_required");
  }

  if (Number.isFinite(qty) && qty > maxTinyQty) {
    blockers.push("tiny_order_quantity_exceeds_max");
  }

  if (!session.marketOpen) blockers.push("market_open_required");
  if (safety.paperTradingKillSwitchActive) blockers.push("paper_trading_kill_switch_active");
  if (!approvalLockPassed) blockers.push("broker_adapter_approval_lock_not_passed");
  if (!approvalRecord.found) blockers.push("explicit_approval_record_missing");
  if (!safety.brokerAdapterEnabled) blockers.push("broker_adapter_env_disabled");
  if (!safety.brokerAdapterRequested) blockers.push("broker_adapter_request_env_missing");
  if (!safety.paperOrderSubmitEnabled) blockers.push("order_submit_not_enabled");

  blockers.push("paper_order_submit_dry_run_only");

  const orderPreview =
    symbol && Number.isFinite(qty) && qty > 0
      ? {
          symbol,
          qty,
          side,
          type,
          timeInForce,
          paperOnly: true,
          tinyOrder: true,
          submitIntent: false,
          submitAttempted: false
        }
      : null;

  return {
    ok: true,
    version: CONTROLLED_FIRST_TINY_PAPER_ORDER_PREFLIGHT_VERSION,
    ts: now.toISOString(),
    status: blockers.length ? "blocked" : "ready_for_separate_borac_submit_approval",
    dryRunOnly: true,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    safety,
    session,
    approval: {
      approvalRecordFound: approvalRecord.found,
      approvalRecordFile: approvalRecord.file,
      approvalLockPassed
    },
    parameters: {
      symbol,
      qty: Number.isFinite(qty) ? qty : null,
      side,
      type,
      timeInForce,
      maxTinyQty
    },
    orderPreview,
    guards,
    blockers,
    nextRequiredAction:
      "Separate explicit Borac approval is required before any first tiny paper order submit path can be enabled."
  };
}

export function writeControlledFirstTinyPaperOrderPreflightReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const file = join(runsDir, `controlled_first_tiny_paper_order_preflight_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
