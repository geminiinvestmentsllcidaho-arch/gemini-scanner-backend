import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("paper trade broker integration preflight short app route redirects to stack app route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  assert.ok(server.includes("/app/paper-trade-broker-integration-preflight"));
  assert.ok(server.includes("/app/paper-trade-broker-integration-preflight-stack"));
  assert.ok(server.includes("res.redirect(302, '/app/paper-trade-broker-integration-preflight-stack')"));
});
