import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../scripts/run_alpaca_under_five_cadence_verifier.mjs", import.meta.url),
  "utf8",
);

test("cadence verifier runner keeps its repeating timer referenced for PM2 persistence", () => {
  assert.match(source, /setInterval\(tick, intervalMs\)/);
  assert.doesNotMatch(source, /\.unref\s*\(/);
  assert.match(source, /Math\.min\(60000, Math\.max\(15000,/);
  assert.match(source, /GS_CADENCE_VERIFIER_EMAIL_SEND_AUTHORIZED/);
  assert.match(source, /process\.once\("SIGINT", stop\)/);
  assert.match(source, /process\.once\("SIGTERM", stop\)/);
  assert.doesNotMatch(source, /gemini-dry-scanner/);
});
