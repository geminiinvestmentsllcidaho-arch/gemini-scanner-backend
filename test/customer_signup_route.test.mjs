import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("server registers gated customer signup routes", () => {
  assert.match(server, /app\.get\(['"]\/signup['"]/);
  assert.match(server, /app\.post\(['"]\/signup['"]/);
  assert.match(server, /CUSTOMER_SIGNUP_ENABLED/);
  assert.match(server, /createCustomerAccountRecord/);
  assert.match(server, /appendCustomerAccountRecord/);
  assert.match(server, /findCustomerAccountByEmail/);
});

test("signup POST route keeps explicit safety gate and pending verification", () => {
  assert.match(server, /status\(503\)/);
  assert.match(server, /pending email verification/i);
  assert.doesNotMatch(server, /orderSubmitted\s*:\s*true/);
});
