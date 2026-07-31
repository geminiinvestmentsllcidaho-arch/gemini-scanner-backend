import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RESET_CONFIRMATION,
  previewPaperManualRoundTripEvidenceReset,
  resetPaperManualRoundTripEvidence,
} from "../src/scanner/paper_manual_round_trip_evidence_reset.mjs";
import { defaultPaperManualRoundTripEvidence } from "../src/scanner/paper_manual_round_trip_evidence_tracker.mjs";

const tempFile = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-reset-"));
  return path.join(dir, "evidence.json");
};

test("preview is non-mutating for absent and clean evidence", () => {
  const absent = tempFile();
  let result = previewPaperManualRoundTripEvidenceReset({ path: absent });
  assert.equal(result.resetNeeded, false);
  assert.equal(fs.existsSync(absent), false);

  const clean = tempFile();
  fs.writeFileSync(clean, JSON.stringify(defaultPaperManualRoundTripEvidence(new Date("2026-07-31T08:00:00Z"))));
  const before = fs.readFileSync(clean, "utf8");
  result = previewPaperManualRoundTripEvidenceReset({ path: clean });
  assert.equal(result.resetNeeded, false);
  assert.equal(fs.readFileSync(clean, "utf8"), before);
});

test("reset requires exact confirmation for malformed incompatible completed and in-progress evidence", () => {
  const fixtures = [
    "{bad",
    JSON.stringify({ version: "old" }),
    JSON.stringify({ ...defaultPaperManualRoundTripEvidence(), roundTripClosed: true }),
    JSON.stringify({ ...defaultPaperManualRoundTripEvidence(), baselineObserved: true }),
  ];

  for (const contents of fixtures) {
    const file = tempFile();
    fs.writeFileSync(file, contents);
    const preview = previewPaperManualRoundTripEvidenceReset({ path: file });
    assert.equal(preview.resetNeeded, true);
    assert.equal(preview.confirmationRequired, RESET_CONFIRMATION);
    assert.throws(
      () => resetPaperManualRoundTripEvidence({ path: file }),
      /confirmation_required/,
    );
    assert.equal(fs.readFileSync(file, "utf8"), contents);
  }
});

test("explicit reset archives prior evidence and writes fresh fail-closed state", () => {
  const file = tempFile();
  fs.writeFileSync(file, "{bad", { mode: 0o600 });

  const result = resetPaperManualRoundTripEvidence({
    path: file,
    confirmation: RESET_CONFIRMATION,
    now: new Date("2026-07-31T08:30:00Z"),
  });

  assert.equal(result.resetPerformed, true);
  assert.ok(result.archivePath);
  assert.equal(fs.existsSync(result.archivePath), true);
  assert.equal(fs.readFileSync(result.archivePath, "utf8"), "{bad");

  const fresh = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(fresh.status, "awaiting_baseline");
  assert.equal(fresh.baselineObserved, false);
  assert.equal(fresh.readOnly, true);
  assert.equal(fresh.brokerContactAllowed, false);
  assert.equal(fresh.orderPlacementAllowed, false);
  assert.equal(fresh.accountMutationAllowed, false);
});

test("reset module never permits watcher start or broker activity", () => {
  const file = tempFile();
  fs.writeFileSync(file, "{bad");
  const preview = previewPaperManualRoundTripEvidenceReset({ path: file });
  assert.equal(preview.safety.localEvidenceOnly, true);
  assert.equal(preview.safety.brokerContactAllowed, false);
  assert.equal(preview.safety.orderPlacementAllowed, false);
  assert.equal(preview.safety.accountMutationAllowed, false);
  assert.equal(preview.safety.watcherStartAllowed, false);
  assert.equal(preview.safety.executionEnabled, false);
  assert.equal(preview.safety.stage2Locked, true);
  assert.equal(preview.safety.stage3Locked, true);
});
