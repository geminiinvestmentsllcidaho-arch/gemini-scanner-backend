import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildPaperManualRoundTripRunbook } from "../scripts/paper_manual_round_trip_runbook.mjs";

test("package exposes explicit Stage 1 preflight and evidence reset operator commands", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(
    pkg.scripts["preflight:paper-manual-round-trip"],
    "node scripts/preview_paper_manual_round_trip_activation_preflight.mjs",
  );
  assert.equal(
    pkg.scripts["reset:paper-manual-round-trip-evidence"],
    "node scripts/reset_paper_manual_round_trip_evidence.mjs",
  );
});

test("runbook requires preflight and explicit evidence reset review while later stages remain locked", () => {
  const runbook = buildPaperManualRoundTripRunbook();
  assert.equal(runbook.version, "paper_manual_round_trip_runbook_v2");
  assert.equal(runbook.steps.length, 11);
  assert.match(runbook.steps[0], /non-mutating activation preflight/i);
  assert.match(runbook.steps[1], /exact confirmation/i);
  assert.equal(runbook.safety.activationPreflightWritesEvidence, false);
  assert.equal(runbook.safety.evidenceResetRequiresExactConfirmation, true);
  assert.equal(runbook.safety.orderPlacementAllowed, false);
  assert.equal(runbook.safety.stage2Locked, true);
  assert.equal(runbook.safety.stage3Locked, true);
});
