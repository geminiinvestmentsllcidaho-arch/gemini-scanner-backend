import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/operator/operator_dashboard.mjs", import.meta.url), "utf8");

test("operator dashboard presents authoritative stream session and connection state", () => {
  assert.match(source, /stream\.marketOpen === true \? "MARKET OPEN"/);
  assert.match(source, /stream\.streamConnected === true \? "STREAM CONNECTED"/);
  assert.match(source, /telemetryLabel = sessionLabel \+ " \| " \+ connectionLabel/);
});

test("operator dashboard consumes shared runtime health issue semantics", () => {
  assert.match(source, /Array\.isArray\(health\.issues\)/);
  assert.match(source, /runtimeIssues\.forEach/);
  assert.match(source, /warnings\.includes\(issue\)/);
  assert.doesNotMatch(source, /stream\.marketOpen === true && stream\.streamConnected !== true/);
  assert.doesNotMatch(source, /warnings\.push\("STREAM_DISCONNECTED"\)/);
});

test("operator dashboard exposes watchdog reconnect history without adding mutation controls", () => {
  assert.match(source, /watchdogTriggerCount/);
  assert.match(source, /warnings\.push\("WATCHDOG_RECONNECT"\)/);
  assert.doesNotMatch(source, /placeOrder|submitOrder|cancelOrder/);
});

test("operator dashboard presents bounded market clock freshness and warns when stale", () => {
  assert.match(source, /stream\.marketClockAgeSec/);
  assert.match(source, /"MARKET CLOCK " \+ marketClockAgeSec \+ "s AGO"/);
  assert.match(source, /health\.issues/);
  assert.doesNotMatch(source, /stream\.marketClockStale === true/);
  assert.doesNotMatch(source, /warnings\.push\("MARKET_CLOCK_STALE"\)/);
  assert.doesNotMatch(source, /marketClockAgeSec > 180/);
});
