import fs from "node:fs";
import path from "node:path";

export const VERSION = "customer_owned_asset_store_v2";
const DEFAULT_STORE_PATH = path.resolve("runs/customer_owned_assets.jsonl");

function clean(value) { return String(value ?? "").trim(); }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function symbol(value) {
  const s = clean(value).toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s) ? s : null;
}
function source(value) {
  const s = clean(value).toLowerCase();
  return ["manual", "alpaca_readonly", "broker_readonly"].includes(s) ? s : "manual";
}
function readRecords(storePath) {
  if (!fs.existsSync(storePath)) return Object.freeze({ ok: true, records: Object.freeze([]) });
  try {
    const records = fs.readFileSync(storePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    return Object.freeze({ ok: true, records: Object.freeze(records) });
  } catch (_error) {
    return Object.freeze({ ok: false, reason: "owned_asset_store_malformed", records: Object.freeze([]) });
  }
}
function latestForAccount(accountId, records) {
  return records.filter((row) => clean(row.accountId) === clean(accountId)).at(-1) ?? null;
}
function writeRecordsAtomically(storePath, records) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);
}
export function normalizeCustomerOwnedAssets(input = []) {
  const rows = Array.isArray(input) ? input : [];
  const out = [];
  for (const row of rows) {
    const ticker = symbol(row?.symbol);
    const qty = finite(row?.qty);
    const averageEntryPrice = finite(row?.averageEntryPrice ?? row?.avgEntryPrice);
    if (!ticker || qty === null || qty <= 0 || averageEntryPrice === null || averageEntryPrice < 0) continue;
    const normalized = Object.freeze({
      symbol: ticker,
      qty,
      averageEntryPrice,
      source: source(row?.source),
      brokerLabel: clean(row?.brokerLabel).slice(0, 40) || null,
    });
    const index = out.findIndex((item) => item.symbol === ticker);
    if (index >= 0) out[index] = normalized;
    else out.push(normalized);
    if (out.length >= 200) break;
  }
  return Object.freeze(out.sort((a, b) => a.symbol.localeCompare(b.symbol)));
}
export function getCustomerOwnedAssets(accountId, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const read = readRecords(storePath);
  if (!read.ok) return Object.freeze({ ok: false, version: VERSION, reason: read.reason, accountId: clean(accountId), positions: Object.freeze([]), updatedAt: null, readOnlyBrokerImport: true, brokerContactAllowed: false, orderPlacementAllowed: false, brokerAccountMutationAllowed: false });
  const record = latestForAccount(accountId, read.records);
  return Object.freeze({
    ok: true,
    version: VERSION,
    accountId: clean(accountId),
    positions: normalizeCustomerOwnedAssets(record?.positions ?? []),
    updatedAt: record?.updatedAt ?? null,
    readOnlyBrokerImport: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    brokerAccountMutationAllowed: false,
  });
}
export function updateCustomerOwnedAssets(accountId, positions = [], options = {}) {
  const id = clean(accountId);
  if (!id) return Object.freeze({ ok: false, reason: "account_id_required" });
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const read = readRecords(storePath);
  if (!read.ok) return Object.freeze({ ok: false, reason: read.reason });
  const normalized = normalizeCustomerOwnedAssets(positions);
  const record = Object.freeze({
    version: VERSION,
    accountId: id,
    positions: normalized,
    updatedAt: options.now ?? new Date().toISOString(),
  });
  const retained = read.records.filter((row) => clean(row.accountId) !== id);
  writeRecordsAtomically(storePath, [...retained, record]);
  return Object.freeze({ ok: true, record, positions: normalized, localPreferenceMutationPerformed: true, brokerAccountMutationAllowed: false });
}
export default { VERSION, normalizeCustomerOwnedAssets, getCustomerOwnedAssets, updateCustomerOwnedAssets };
