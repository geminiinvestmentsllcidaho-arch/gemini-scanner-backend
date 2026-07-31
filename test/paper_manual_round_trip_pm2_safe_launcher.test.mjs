import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("PM2-safe manual watcher launcher removes inherited Node IPC variables", () => {
  const text = fs.readFileSync("scripts/run_paper_manual_round_trip_watcher_pm2_safe.sh", "utf8");
  assert.match(text, /^#!\/usr\/bin\/env bash/m);
  assert.match(text, /unset NODE_CHANNEL_FD NODE_UNIQUE_ID/);
  assert.match(text, /exec \/usr\/bin\/node \.\/scripts\/watch_paper_manual_round_trip_evidence\.mjs "\$@"/);
});

test("ecosystem uses the IPC-safe launcher without a Node interpreter", () => {
  const text = fs.readFileSync("ecosystem.config.cjs", "utf8");
  assert.match(text, /name: "gemini-paper-manual-watcher"[\s\S]*script: "\.\/scripts\/run_paper_manual_round_trip_watcher_pm2_safe\.sh"/);
  assert.match(text, /name: "gemini-paper-manual-watcher"[\s\S]*interpreter: "none"/);
});
