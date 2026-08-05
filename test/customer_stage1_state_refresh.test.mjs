import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const asset = fs.readFileSync("public/assets/customer-stage1-state-refresh.js", "utf8");
const server = fs.readFileSync("src/server.js", "utf8");

test("reloads only after a read-only Stage 1 state change", () => {
  assert.match(asset, /fetch\(location\.href/);
  assert.match(asset, /credentials: "same-origin"/);
  assert.match(asset, /cache: "no-store"/);
  assert.match(asset, /DOMParser/);
  assert.match(asset, /nextKey !== currentKey\(\)/);
  assert.match(asset, /location\.reload\(\)/);
  assert.match(asset, /document\.hidden/);
  assert.doesNotMatch(asset, /method: "POST"|method: "DELETE"|\/v2\/orders/);
});

test("serves the archived refresh asset but keeps it disconnected from the Portfolio page", () => {
  assert.match(server, /app\.get\('\/assets\/customer-stage1-state-refresh\.js'/);
  const start = server.indexOf("app.get('/customer/portfolio'");
  const end = server.indexOf("app.post('/customer/portfolio/owned-assets'", start);
  const block = server.slice(start, end);
  assert.doesNotMatch(block, /const stage1StateKey = JSON\.stringify|stage1StateKey,/);
  const page = fs.readFileSync("src/scanner/customer_portfolio_page.mjs", "utf8");
  assert.doesNotMatch(page, /customer-stage1-state-refresh\.js|data-stage1-state-key/);
});
