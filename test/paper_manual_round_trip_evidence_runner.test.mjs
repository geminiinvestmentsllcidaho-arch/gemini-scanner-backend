import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { runPaperManualRoundTripEvidenceTracker } from "../scripts/run_paper_manual_round_trip_evidence_tracker.mjs";

const snap = (positions) => ({ status: "connected_readonly", positions });

test("runner persists baseline and resumes exact one-share evidence across invocations", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-runner-"));
  const file = path.join(dir, "state.json");
  let result = await runPaperManualRoundTripEvidenceTracker({ path: file, snapshot: snap([]), now: new Date("2026-07-30T20:00:00Z") });
  assert.equal(result.state.status, "awaiting_manual_enter");
  result = await runPaperManualRoundTripEvidenceTracker({ path: file, snapshot: snap([{ symbol: "SPY", qty: 1, side: "long" }]), now: new Date("2026-07-30T20:01:00Z") });
  assert.equal(result.state.status, "monitoring_manual_position");
  assert.equal(result.state.symbol, "SPY");
  assert.equal(result.safety.orderPlacementAllowed, false);
});

test("runner completes only after exit and explicit recovery checks", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-runner-"));
  const file = path.join(dir, "state.json");
  await runPaperManualRoundTripEvidenceTracker({ path: file, snapshot: snap([]) });
  await runPaperManualRoundTripEvidenceTracker({ path: file, snapshot: snap([{ symbol: "SPY", qty: 1, side: "long" }]) });
  let result = await runPaperManualRoundTripEvidenceTracker({ path: file, snapshot: snap([]) });
  assert.equal(result.promotionProof.mechanicalSuccess, false);
  result = await runPaperManualRoundTripEvidenceTracker({ path: file, snapshot: snap([]), restartRecoveryVerified: true, duplicateProtectionVerified: true });
  assert.equal(result.promotionProof.mechanicalSuccess, true);
  assert.equal(result.promotionProof.entryReconciled, true);
});

test("runner fails closed without connected readonly account", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-runner-"));
  const result = await runPaperManualRoundTripEvidenceTracker({ path: path.join(dir, "state.json"), snapshot: { status: "readonly_fetch_failed", positions: [] } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.state.issues, ["paper_account_not_connected_readonly"]);
  assert.equal(result.safety.executionEnabled, false);
});

test("runner names readonly broker access precisely", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-runner-"));
  const result = await runPaperManualRoundTripEvidenceTracker({ path: path.join(dir, "state.json"), snapshot: snap([]) });
  assert.equal(result.safety.readonlyBrokerReadAllowed, true);
  assert.equal(result.safety.brokerContactAllowed, false);
  assert.equal(result.safety.orderPlacementAllowed, false);
});

test("runner fails closed on malformed or incompatible persisted state", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-runner-"));
  const malformed = path.join(dir, "malformed.json");
  fs.writeFileSync(malformed, "{not-json");
  await assert.rejects(
    () => runPaperManualRoundTripEvidenceTracker({ path: malformed, snapshot: snap([]) }),
    SyntaxError,
  );

  const incompatible = path.join(dir, "incompatible.json");
  fs.writeFileSync(incompatible, JSON.stringify({
    version: "paper_manual_round_trip_evidence_tracker_v1",
    stage: "manual_detection_only",
    readOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  }));
  await assert.rejects(
    () => runPaperManualRoundTripEvidenceTracker({ path: incompatible, snapshot: snap([]) }),
    /paper_manual_round_trip_persisted_state_invalid/,
  );
});
