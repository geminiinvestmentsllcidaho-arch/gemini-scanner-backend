import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPaperManualRoundTripActivationPreflight } from "../src/scanner/paper_manual_round_trip_activation_preflight.mjs";
import { defaultPaperManualRoundTripEvidence } from "../src/scanner/paper_manual_round_trip_evidence_tracker.mjs";

const now = new Date("2026-07-31T14:00:00.000Z");
const snapshot = (overrides = {}) => ({ status: "connected_readonly", observedAt: "2026-07-31T13:59:30.000Z", positions: [], openOrders: [], ...overrides });

test("preflight is ready only for fresh zero-position zero-order snapshot and absent evidence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-preflight-"));
  const result = buildPaperManualRoundTripActivationPreflight(snapshot(), { now, path: path.join(dir, "missing.json") });
  assert.equal(result.ready, true);
  assert.equal(result.decision, "READY_TO_ACTIVATE");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.safety.writesEvidence, false);
  assert.equal(result.safety.startsWatcher, false);
});

test("preflight blocks held positions and open orders", () => {
  const result = buildPaperManualRoundTripActivationPreflight(snapshot({ positions: [{ symbol: "SPY", qty: 1, side: "long" }], openOrders: [{ symbol: "SPY", side: "sell" }] }), { now, evidenceInspection: { stateCondition: "absent", blocker: null } });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("manual_baseline_requires_zero_positions"));
  assert.ok(result.blockers.includes("manual_baseline_requires_zero_open_orders"));
});

test("preflight blocks stale or incomplete snapshots", () => {
  const result = buildPaperManualRoundTripActivationPreflight({ status: "connected_readonly", observedAt: "2026-07-31T13:00:00.000Z" }, { now, evidenceInspection: { stateCondition: "absent", blocker: null } });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("paper_account_snapshot_stale_or_missing"));
  assert.ok(result.blockers.includes("paper_positions_unavailable"));
  assert.ok(result.blockers.includes("paper_open_orders_unavailable"));
});

test("preflight blocks malformed incompatible completed and in-progress evidence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-preflight-"));
  const malformed = path.join(dir, "malformed.json");
  fs.writeFileSync(malformed, "{bad");
  assert.ok(buildPaperManualRoundTripActivationPreflight(snapshot(), { now, path: malformed }).blockers.includes("persisted_evidence_malformed"));
  const incompatible = path.join(dir, "incompatible.json");
  fs.writeFileSync(incompatible, JSON.stringify({ version: "old" }));
  assert.ok(buildPaperManualRoundTripActivationPreflight(snapshot(), { now, path: incompatible }).blockers.includes("persisted_evidence_invalid"));
  const completed = path.join(dir, "completed.json");
  fs.writeFileSync(completed, JSON.stringify({ ...defaultPaperManualRoundTripEvidence(now), roundTripClosed: true }));
  assert.ok(buildPaperManualRoundTripActivationPreflight(snapshot(), { now, path: completed }).blockers.includes("persisted_evidence_completed_requires_explicit_reset"));
  const progress = path.join(dir, "progress.json");
  fs.writeFileSync(progress, JSON.stringify({ ...defaultPaperManualRoundTripEvidence(now), baselineObserved: true }));
  assert.ok(buildPaperManualRoundTripActivationPreflight(snapshot(), { now, path: progress }).blockers.includes("persisted_evidence_in_progress"));
});
