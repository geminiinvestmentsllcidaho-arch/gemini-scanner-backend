import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const FIRST_TINY_PAPER_ORDER_APPROVAL_RECORD_VERSION =
  "first_tiny_paper_order_approval_record_v1";

export const REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE =
  "I_APPROVE_FIRST_TINY_PAPER_ORDER_SUBMIT_PREFLIGHT_ONLY";

function parseArgs(argv = []) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}

function normalizeSymbol(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeSide(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function buildFirstTinyPaperOrderApprovalRecord(options = {}) {
  const argv = options.argv ?? [];
  const args = options.args ?? parseArgs(argv);
  const now = options.now ?? new Date();

  const by = String(args.by ?? "").trim();
  const reason = String(args.reason ?? "").trim();
  const approvalPhrase = String(args.approval ?? args.phrase ?? "").trim();

  const symbol = normalizeSymbol(args.symbol);
  const side = normalizeSide(args.side ?? "buy");
  const qtyRaw = String(args.qty ?? "").trim();
  const qty = Number(qtyRaw);

  const blockers = [];

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 10) blockers.push("approval_reason_required");
  if (approvalPhrase !== REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE) {
    blockers.push("exact_approval_phrase_required");
  }
  if (!symbol || !Number.isFinite(qty) || qty <= 0 || !["buy", "sell"].includes(side)) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(qty) && qty > 1) blockers.push("tiny_order_quantity_exceeds_one_share");

  const approved = blockers.length === 0;

  return {
    ok: true,
    version: FIRST_TINY_PAPER_ORDER_APPROVAL_RECORD_VERSION,
    ts: now.toISOString(),
    approvalScope: "first_tiny_paper_order_submit_preflight_only",
    approved,
    approvalStatus: approved ? "approved" : "blocked",
    status: approved ? "approved" : "blocked",
    by: by || null,
    reason: reason || null,
    requiredApprovalPhrase: REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE,
    approvalPhraseMatched: approvalPhrase === REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE,
    parameters: {
      symbol,
      qty: Number.isFinite(qty) ? qty : null,
      side,
      type: String(args.type ?? "market").trim().toLowerCase(),
      timeInForce: String(args.tif ?? args.timeInForce ?? "day").trim().toLowerCase()
    },
    safety: {
      paperOnly: true,
      dryRunOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false
    },
    blockers,
    nextRequiredAction: approved
      ? "Run controlled preflight again during regular market hours. This approval record does not submit an order."
      : "Provide Borac identity, exact approval phrase, tiny order parameters, and approval reason."
  };
}

export function writeFirstTinyPaperOrderApprovalRecord(record, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = record.ts.replace(/[:.]/g, "-");
  const suffix = record.approved ? "approved" : "blocked";
  const file = join(runsDir, `first_tiny_paper_order_approval_record_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}
