import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("preparation route is authenticated same-origin and non-broker", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  const start = source.indexOf("app.post('/customer/paper-order/prepare'");
  assert.ok(start >= 0);
  const end = source.indexOf("app.post('/customer/portfolio/owned-assets'", start);
  const block = source.slice(start, end);
  assert.match(block, /requireCustomerSession/);
  assert.match(block, /requireCustomerSameOrigin/);
  assert.match(block, /buildCustomerPaperOrderPreparation/);
  assert.doesNotMatch(block, /submitPaperAutoOrder|\/v2\/orders|fetch\(/);
});

test("scanner and portfolio expose preparation-only controls", () => {
  const cards = fs.readFileSync("src/scanner/customer_zero_decision_cards.mjs", "utf8");
  const portfolio = fs.readFileSync("src/scanner/customer_portfolio_page.mjs", "utf8");
  assert.match(cards, /Prepare 1-share PAPER ENTER/);
  assert.match(portfolio, /EXIT PAPER POSITION/);
});


test("preparation route binds persisted preparation to authenticated account", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  const start = source.indexOf("app.post('/customer/paper-order/prepare'");
  const end = source.indexOf("app.post('/customer/paper-order/mock-exercise'", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /persistCustomerPaperOrderPreparation\(record,\s*\{\s*accountId:\s*req\.customerAccount\?\.id\s*\}\)/);
});

test("preparation route maps expected lifecycle conflicts to 409 without broker execution", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  const start = source.indexOf("app.post('/customer/paper-order/prepare'");
  const end = source.indexOf("app.post('/customer/paper-order/mock-exercise'", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /paper_enter_customer_preparation_in_progress/);
  assert.match(block, /paper_enter_active_customer_lifecycle_exists/);
  assert.match(block, /paper_exit_matching_lifecycle_not_found/);
  assert.match(block, /paper_preparation_account_mismatch/);
  assert.match(block, /res\.status\(409\)/);
  assert.match(block, /Refresh the scanner or portfolio and try again/);
  assert.match(block, /No broker contact or order placement occurred/);
  assert.doesNotMatch(block, /submitPaperAutoOrder|submitPaperOrder|\/v2\/orders|fetch\(/);
});
