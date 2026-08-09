import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const settings = fs.readFileSync("public/assets/customer-exit-notification-settings.js", "utf8");

test("customer EXIT notification settings use the owned five-note custom chime", () => {
  assert.match(settings, /playGeminiScannerExitChime/);
  assert.match(settings, /659\.25/);
  assert.match(settings, /783\.99/);
  assert.match(settings, /987\.77/);
  assert.match(settings, /523\.25/);
  assert.match(settings, /start:\s*1\.06/);
  assert.match(settings, /duration:\s*0\.42/);
  assert.match(settings, /exponentialRampToValueAtTime/);
});

test("Settings EXIT test reports the custom chime when browser audio succeeds", () => {
  assert.match(settings, /custom EXIT chime played/);
  assert.match(settings, /navigator\.vibrate/);
});
