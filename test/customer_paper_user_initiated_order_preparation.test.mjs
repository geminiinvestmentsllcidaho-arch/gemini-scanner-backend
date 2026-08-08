import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildCustomerPaperOrderPreparation,
  persistCustomerPaperOrderPreparation,
} from "../src/scanner/customer_paper_user_initiated_order_preparation.mjs";

test("prepares one-share PAPER ENTER without broker execution permission", () => {
  const record = buildCustomerPaperOrderPreparation({
    mode: "ENTER", symbol: "abc", quantity: 1, paperOnly: true,
  });
  assert.equal(record.ok, true);
  assert.equal(record.orderPreview.symbol, "ABC");
  assert.equal(record.orderPreview.side, "buy");
  assert.equal(record.orderPreview.qty, 1);
  assert.equal(record.safety.orderPlacementAllowed, false);
  assert.equal(record.safety.brokerContactAllowed, false);
});

test("prepares exact PAPER EXIT quantity without broker execution permission", () => {
  const record = buildCustomerPaperOrderPreparation({
    mode: "EXIT", symbol: "btg", quantity: 2.5, paperOnly: true,
  });
  assert.equal(record.ok, true);
  assert.equal(record.orderPreview.side, "sell");
  assert.equal(record.orderPreview.qty, 2.5);
  assert.equal(record.safety.accountMutationAllowed, false);
});

test("ENTER is locked to one share", () => {
  const record = buildCustomerPaperOrderPreparation({
    mode: "ENTER", symbol: "ABC", quantity: 2, paperOnly: true,
  });
  assert.equal(record.ok, false);
  assert.ok(record.blockers.includes("mechanical_enter_quantity_locked_to_one"));
});


test("persisted preparation is bound to authenticated customer account", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-paper-prep-account-"));
  const record = buildCustomerPaperOrderPreparation({ mode:"ENTER", symbol:"ABC", quantity:1, paperOnly:true }, { now:new Date("2026-08-07T19:00:00.000Z") });
  const saved = persistCustomerPaperOrderPreparation(record, { dir, accountId:"customer-zero" });
  assert.equal(saved.customerAccountId, "customer-zero");
  const onDisk = JSON.parse(fs.readFileSync(saved.file, "utf8"));
  assert.equal(onDisk.customerAccountId, "customer-zero");
});

test("preparation persistence fails closed without customer account", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-paper-prep-no-account-"));
  const record = buildCustomerPaperOrderPreparation({ mode:"ENTER", symbol:"ABC", quantity:1, paperOnly:true });
  assert.throws(() => persistCustomerPaperOrderPreparation(record, { dir }), /customer_account_required/);
});
