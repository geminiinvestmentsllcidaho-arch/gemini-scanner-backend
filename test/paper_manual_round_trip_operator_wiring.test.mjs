import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { previewPaperManualRoundTripActivationPreflight } from "../scripts/preview_paper_manual_round_trip_activation_preflight.mjs";
import { runPaperManualRoundTripEvidenceResetCli } from "../scripts/reset_paper_manual_round_trip_evidence.mjs";
import { RESET_CONFIRMATION } from "../src/scanner/paper_manual_round_trip_evidence_reset.mjs";

const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "manual-operator-")), "evidence.json");

test("operator preflight performs one supplied read and never writes evidence", async () => {
  const file = tempFile();
  let calls = 0;
  const result = await previewPaperManualRoundTripActivationPreflight({
    path: file,
    now: new Date("2026-07-31T14:00:00Z"),
    fetchAccount: async () => {
      calls += 1;
      return { status: "connected_readonly", observedAt: "2026-07-31T13:59:30Z", positions: [], openOrders: [] };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.ready, true);
  assert.equal(fs.existsSync(file), false);
  assert.equal(result.safety.writesEvidence, false);
  assert.equal(result.safety.startsWatcher, false);
});

test("reset CLI previews by default and requires exact confirmation to reset local evidence", () => {
  const file = tempFile();
  fs.writeFileSync(file, "{bad", { mode: 0o600 });
  let result = runPaperManualRoundTripEvidenceResetCli({ path: file });
  assert.equal(result.mode, "preview_only");
  assert.equal(fs.readFileSync(file, "utf8"), "{bad");

  result = runPaperManualRoundTripEvidenceResetCli({
    path: file,
    confirmation: RESET_CONFIRMATION,
    now: new Date("2026-07-31T14:30:00Z"),
  });
  assert.equal(result.resetPerformed, true);
  assert.equal(fs.existsSync(result.archivePath), true);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).status, "awaiting_baseline");
});

test("operator scripts contain no watcher start or broker mutation capability", () => {
  for (const file of [
    "scripts/preview_paper_manual_round_trip_activation_preflight.mjs",
    "scripts/reset_paper_manual_round_trip_evidence.mjs",
  ]) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /pm2\s+start|watch_paper_manual|POST|DELETE|submitOrder|cancelOrder/);
  }
});
