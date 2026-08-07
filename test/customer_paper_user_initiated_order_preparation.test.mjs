import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerPaperOrderPreparation,
} from "../src/scanner/customer_paper_user_initiated_order_preparation.mjs";

test("prepares one-share PAPER ENTER without broker execution permission", () => {
  const record = buildCustomerPaperOrderPreparation({
    mode: "ENTER", symbol: "abc", quantity: 1, paperOnly: true, userConfirmed: true,
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
    mode: "EXIT", symbol: "btg", quantity: 2.5, paperOnly: true, userConfirmed: true,
  });
  assert.equal(record.ok, true);
  assert.equal(record.orderPreview.side, "sell");
  assert.equal(record.orderPreview.qty, 2.5);
  assert.equal(record.safety.accountMutationAllowed, false);
});

test("ENTER is locked to one share", () => {
  const record = buildCustomerPaperOrderPreparation({
    mode: "ENTER", symbol: "ABC", quantity: 2, paperOnly: true, userConfirmed: true,
  });
  assert.equal(record.ok, false);
  assert.ok(record.blockers.includes("mechanical_enter_quantity_locked_to_one"));
});
