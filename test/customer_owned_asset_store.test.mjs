import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeCustomerOwnedAssets, updateCustomerOwnedAssets, getCustomerOwnedAssets } from "../src/scanner/customer_owned_asset_store.mjs";

test("normalizes manual and readonly-imported owned assets", () => {
  const rows = normalizeCustomerOwnedAssets([
    { symbol: "spy", qty: 2, averageEntryPrice: 500, source: "manual", brokerLabel: "Alpaca" },
    { symbol: "bad symbol", qty: 1, averageEntryPrice: 1 },
    { symbol: "AAPL", qty: 0, averageEntryPrice: 100 },
  ]);
  assert.deepEqual(rows.map((row) => row.symbol), ["SPY"]);
  assert.equal(rows[0].brokerLabel, "Alpaca");
});

test("persists customer-owned assets without broker or order capability", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-owned-assets-"));
  const storePath = path.join(dir, "owned.jsonl");
  const saved = updateCustomerOwnedAssets("acct-1", [{ symbol: "MSFT", qty: 3, averageEntryPrice: 420 }], { storePath, now: "2026-07-30T00:00:00.000Z" });
  assert.equal(saved.ok, true);
  const loaded = getCustomerOwnedAssets("acct-1", { storePath });
  assert.equal(loaded.positions[0].symbol, "MSFT");
  assert.equal(loaded.brokerContactAllowed, false);
  assert.equal(loaded.orderPlacementAllowed, false);
  assert.equal(loaded.brokerAccountMutationAllowed, false);
});


test("fails closed on malformed owned-asset storage", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-owned-assets-bad-"));
  const storePath = path.join(dir, "owned.jsonl");
  fs.writeFileSync(storePath, "{bad}\n", { mode: 0o600 });
  const loaded = getCustomerOwnedAssets("acct-1", { storePath });
  assert.equal(loaded.ok, false);
  assert.deepEqual(loaded.positions, []);
  assert.equal(updateCustomerOwnedAssets("acct-1", [{ symbol: "SPY", qty: 1, averageEntryPrice: 500 }], { storePath }).ok, false);
});
