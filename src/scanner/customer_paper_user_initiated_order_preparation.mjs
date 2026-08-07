import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const VERSION = "customer_paper_user_initiated_order_preparation_v1";

const clean = (v) => String(v ?? "").trim();
const normalizeSymbol = (v) => clean(v).toUpperCase().replace(/[^A-Z0-9.-]/g, "");
const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function buildCustomerPaperOrderPreparation(input = {}, options = {}) {
  const mode = clean(input.mode).toUpperCase();
  const symbol = normalizeSymbol(input.symbol);
  const quantity = positive(input.quantity);
  const side = mode === "ENTER" ? "buy" : mode === "EXIT" ? "sell" : null;
  const blockers = [];

  if (!side) blockers.push("mode_must_be_enter_or_exit");
  if (!symbol) blockers.push("symbol_required");
  if (quantity === null) blockers.push("positive_quantity_required");
  if (mode === "ENTER" && quantity !== 1) blockers.push("mechanical_enter_quantity_locked_to_one");
  if (input.paperOnly !== true) blockers.push("paper_only_required");
  if (input.userConfirmed !== true) blockers.push("explicit_user_confirmation_required");

  const now = options.now instanceof Date ? options.now : new Date();
  const preparationId = blockers.length === 0
    ? `customer-paper-${mode.toLowerCase()}-${now.toISOString().replace(/[-:.TZ]/g, "")}-${crypto.randomBytes(4).toString("hex")}`
    : null;

  return Object.freeze({
    ok: blockers.length === 0,
    version: VERSION,
    status: blockers.length === 0 ? "PAPER_ORDER_PREPARATION_READY" : "PAPER_ORDER_PREPARATION_BLOCKED",
    preparationId,
    createdAt: now.toISOString(),
    mode,
    symbol: symbol || null,
    quantity,
    orderPreview: blockers.length === 0 ? Object.freeze({
      symbol,
      qty: quantity,
      side,
      type: "market",
      timeInForce: "day",
      paperOnly: true,
    }) : null,
    blockers: Object.freeze(blockers),
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      submissionEnabled: false,
      preparationOnly: true,
      userInitiated: true,
    }),
  });
}

export function persistCustomerPaperOrderPreparation(record, options = {}) {
  if (record?.ok !== true || !record?.preparationId) throw new Error("valid_preparation_required");
  const accountId = clean(options.accountId);
  if (!accountId) throw new Error("customer_account_required");
  const dir = options.dir ?? "runs/customer_paper_order_preparations";
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${record.preparationId}.json`);
  const persisted = Object.freeze({ ...record, customerAccountId: accountId });
  fs.writeFileSync(file, `${JSON.stringify(persisted, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  return Object.freeze({ ...persisted, file });
}

export default { VERSION, buildCustomerPaperOrderPreparation, persistCustomerPaperOrderPreparation };
