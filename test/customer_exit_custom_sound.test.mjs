import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const settings = fs.readFileSync("public/assets/customer-exit-notification-settings.js", "utf8");
const stage1 = fs.readFileSync("public/assets/customer-stage1-exit-alerts.js", "utf8");

test("customer EXIT notification clients use the owned five-note custom chime", () => {
  for (const source of [settings, stage1]) {
    assert.match(source, /playGeminiScannerExitChime/);
    assert.match(source, /659\.25/);
    assert.match(source, /783\.99/);
    assert.match(source, /987\.77/);
    assert.match(source, /523\.25/);
    assert.match(source, /start:\s*1\.06/);
    assert.match(source, /duration:\s*0\.42/);
    assert.match(source, /exponentialRampToValueAtTime/);
  }
});

test("Settings EXIT test reports the custom chime when browser audio succeeds", () => {
  assert.match(settings, /custom EXIT chime played/);
  assert.match(settings, /navigator\.vibrate/);
});

test("Stage 1 EXIT alert keeps visual vibration and acknowledgement behavior", () => {
  assert.match(stage1, /data-stage1-exit-alert/);
  assert.match(stage1, /navigator\.vibrate/);
  assert.match(stage1, /gs\.stage1\.exit\.fired/);
  assert.match(stage1, /gs\.stage1\.exit\.ack/);
  assert.match(stage1, /EXIT alert acknowledged on this device/);
});
