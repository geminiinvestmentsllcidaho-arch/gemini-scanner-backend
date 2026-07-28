import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/operator/operator_dashboard.mjs", import.meta.url), "utf8");

test("operator dashboard presents authoritative stream session and connection state", () => {
  assert.match(source, /stream\.marketOpen === true \? "MARKET OPEN"/);
  assert.match(source, /stream\.streamConnected === true \? "STREAM CONNECTED"/);
  assert.match(source, /telemetryLabel = sessionLabel \+ " \| " \+ connectionLabel/);
});

test("operator dashboard only escalates disconnected stream during authoritative open session", () => {
  assert.match(source, /stream\.marketOpen === true && stream\.streamConnected !== true/);
  assert.match(source, /warnings\.push\("STREAM_DISCONNECTED"\)/);
});

test("operator dashboard exposes watchdog reconnect history without adding mutation controls", () => {
  assert.match(source, /watchdogTriggerCount/);
  assert.match(source, /warnings\.push\("WATCHDOG_RECONNECT"\)/);
  assert.doesNotMatch(source, /placeOrder|submitOrder|cancelOrder/);
});
