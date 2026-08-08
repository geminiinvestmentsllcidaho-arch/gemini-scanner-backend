import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const server = readFileSync("src/server.js", "utf8");

test("paper broker runtime and network diagnostic aliases are registered read-only and historical-safe", () => {
  assert.match(server, /app\.get\('\/diagnostics\/paper-broker-runtime-environment-preflight'/);
  assert.match(server, /buildPaperBrokerRuntimeEnvironmentPreflightAppScreen\(\{ loadSourceReport: false \}\)/);
  assert.match(server, /app\.get\('\/diagnostics\/paper-broker-network-attempt-status'/);
  assert.match(server, /buildPaperBrokerNetworkAttemptStatusAppScreen\(\{ loadSourceReport: false \}\)/);

  const runtimeStart = server.indexOf("app.get('/diagnostics/paper-broker-runtime-environment-preflight'");
  const networkStart = server.indexOf("app.get('/diagnostics/paper-broker-network-attempt-status'");
  assert.ok(runtimeStart > 0);
  assert.ok(networkStart > 0);

  const runtimeBlock = server.slice(runtimeStart, server.indexOf("app.get('/app/paper-broker-network-attempt-status'", runtimeStart));
  const networkBlock = server.slice(networkStart, server.indexOf("app.get('/app/paper-trading-readiness-gate'", networkStart));
  const combined = `${runtimeBlock}\n${networkBlock}`;

  assert.doesNotMatch(combined, /\.post\(/);
  assert.doesNotMatch(combined, /\.delete\(/);
  assert.doesNotMatch(combined, /orderPlacementAllowed:\s*true/);
  assert.doesNotMatch(combined, /brokerContactAllowed:\s*true/);
  assert.doesNotMatch(combined, /accountMutationAllowed:\s*true/);
  assert.doesNotMatch(combined, /loadReport:\s*true/);
  assert.doesNotMatch(combined, /loadReport:\s*false/);
});
