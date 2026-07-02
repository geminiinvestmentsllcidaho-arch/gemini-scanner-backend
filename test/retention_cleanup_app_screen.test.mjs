import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRetentionCleanupAppScreen,
  renderRetentionCleanupAppScreenHtml,
} from "../src/scanner/retention_cleanup_app_screen.mjs";

test("builds read-only retention cleanup app screen from supplied panel", () => {
  const screen = buildRetentionCleanupAppScreen({
    now: new Date("2026-07-02T23:50:00Z"),
    retentionDays: 30,
    limit: 5,
    panel: {
      ok: true,
      version: "fixture_panel_v1",
      displayState: "FIXTURE_PANEL_READY",
      retentionDays: 30,
      candidateCount: 2,
      files: [
        {
          name: "old.jsonl",
          ageDays: 45,
          status: "preview_cleanup_candidate",
          ts: "2026-06-01T00:00:00Z",
          eligible: true,
        },
        {
          name: "new.jsonl",
          ageDays: 4,
          status: "retained",
          ts: "2026-07-01T00:00:00Z",
          eligible: false,
        },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "retention_cleanup_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.displayState, "RETENTION_CLEANUP_APP_SCREEN_READY_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.retentionDays, 30);
  assert.equal(screen.candidateCount, 2);
  assert.equal(screen.visibleCount, 2);
  assert.equal(screen.files[0].name, "old.jsonl");
  assert.equal(screen.files[0].eligibleForCleanup, true);
  assert.equal(screen.files[0].previewOnly, true);
  assert.equal(screen.files[1].status, "retained");
  assert.equal(screen.summaryCards.length, 3);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.deletionAllowed, false);
  assert.equal(screen.fileDeletionAllowed, false);
  assert.equal(screen.fileDeleted, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.liveTradingAllowed, false);
  assert.equal(screen.autoTradingAllowed, false);
  assert.equal(screen.orderSubmitted, false);
  assert.equal(screen.brokerContactAttempted, false);
  assert.equal(screen.accountMutationAttempted, false);
});

test("renders retention cleanup html without mutation controls", () => {
  const screen = buildRetentionCleanupAppScreen({
    panel: {
      ok: true,
      retentionDays: 30,
      candidateCount: 1,
      files: [
        {
          name: "old.jsonl",
          ageDays: 45,
          status: "preview_cleanup_candidate",
          ts: "2026-06-01T00:00:00Z",
          eligible: true,
        },
      ],
    },
  });

  const html = renderRetentionCleanupAppScreenHtml(screen);

  assert.match(html, /Retention Cleanup Preview/);
  assert.match(html, /old\.jsonl/);
  assert.match(html, /Preview only/);
  assert.match(html, /No file deletion/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
