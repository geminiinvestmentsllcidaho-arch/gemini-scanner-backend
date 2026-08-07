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
  assert.match(portfolio, /Prepare PAPER EXIT/);
});
