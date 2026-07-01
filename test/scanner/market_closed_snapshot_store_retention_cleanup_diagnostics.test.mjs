import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildMarketClosedSnapshotStoreRetentionCleanupDiagnostics, buildMarketClosedSnapshotStoreRetentionCleanupPanel } from "../../src/scanner/market_closed_snapshot_store_retention_cleanup_diagnostics.mjs";

test("retention cleanup diagnostics is read-only and only previews old files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-retention-"));
  fs.writeFileSync(path.join(dir, "snapshot_2026-05-01T000000Z.json"), "{}");
  fs.writeFileSync(path.join(dir, "snapshot_2026-06-29T000000Z.json"), "{}");
  const r = buildMarketClosedSnapshotStoreRetentionCleanupDiagnostics({ storeDir: dir, nowMs: Date.parse("2026-07-01T12:00:00Z"), retentionDays: 30, limit: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.displayState, "READ_ONLY");
  assert.equal(r.diagnosticsOnly, true);
  assert.equal(r.monitorOnly, true);
  assert.equal(r.localStoreOnly, true);
  assert.equal(r.noExecutionControls, true);
  assert.equal(r.cleanupDeletionAllowed, false);
  assert.equal(r.cleanupExecutionAllowed, false);
  assert.equal(r.deleteCommandsGenerated, false);
  assert.deepEqual(r.cleanupPreview.deleteCommands, []);
  assert.equal(r.store.jsonFileCount, 2);
  assert.equal(r.cleanupPreview.candidateCount, 1);
  assert.match(r.cleanupPreview.candidates[0].relativePath, /2026-05-01/);
});

test("retention cleanup panel preserves read-only card state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-retention-panel-"));
  const p = buildMarketClosedSnapshotStoreRetentionCleanupPanel({ storeDir: dir, nowMs: Date.parse("2026-07-01T12:00:00Z") });
  assert.equal(p.panelType, "operator_dashboard_card");
  assert.equal(p.displayState, "READ_ONLY");
  assert.equal(p.cleanupDeletionAllowed, false);
  assert.equal(p.summary.deletionPerformed, false);
});
