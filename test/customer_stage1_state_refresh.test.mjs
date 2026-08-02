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

test("serves refresh asset and derives a non-secret Stage 1 state key", () => {
  assert.match(server, /app\.get\('\/assets\/customer-stage1-state-refresh\.js'/);
  assert.match(server, /const stage1StateKey = JSON\.stringify/);
  assert.match(server, /enterDetected:/);
  assert.match(server, /exitDetected:/);
  assert.match(server, /mechanicalSuccess:/);
  assert.match(server, /stage1StateKey,/);
});
