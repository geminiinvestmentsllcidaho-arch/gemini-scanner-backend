import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  assert.equal(screen.summaryCards.length, 7);
  assert.equal(screen.summaryCards[1].label, "Archive Storage");
  assert.equal(screen.summaryCards[5].label, "Max Archives");
  assert.equal(screen.summaryCards[6].label, "Storage Limit");
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

test("builds opportunity audit archive retention preview through the shared read-only app screen", () => {
  const screen = buildRetentionCleanupAppScreen({
    source: "opportunity_audit",
    archiveDir: "/tmp/gemini-scanner-missing-opportunity-retention-test",
    now: new Date("2026-07-21T12:00:00.000Z"),
    autoRefreshEnabled: false,
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.title, "Opportunity Audit Archive Retention Preview");
  assert.equal(screen.sourceVersion, "opportunity_funnel_audit_archive_retention_preview_v1");
  assert.equal(screen.candidateCount, 0);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.fileDeletionAllowed, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
});

test("opportunity audit retention screen shows retained archives even when no cleanup candidate exists", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const archiveDir = mkdtempSync(join(tmpdir(), "gemini-opportunity-retention-visible-"));
  try {
    const archiveName = "opportunity_funnel_audit-20260721T120000Z.jsonl";
    writeFileSync(join(archiveDir, archiveName), "{\"ok\":true}\n");

    const screen = buildRetentionCleanupAppScreen({
      source: "opportunity_audit",
      archiveDir,
      now: new Date("2026-07-21T12:05:00.000Z"),
      autoRefreshEnabled: false,
    });

    assert.equal(screen.archiveCount, 1);
    assert.equal(screen.candidateCount, 0);
    assert.equal(screen.visibleCount, 1);
    assert.equal(screen.files[0].name, archiveName);
    assert.equal(screen.files[0].status, "retained_within_policy");
    assert.equal(screen.files[0].eligibleForCleanup, false);
    assert.equal(screen.files[0].previewOnly, true);
    assert.ok(screen.totalBytes > 0);
    assert.equal(screen.files[0].ageDays, 0);
    assert.match(screen.files[0].sizeDisplay, /B$/);
    assert.equal(screen.fileDeletionAllowed, false);

    const html = renderRetentionCleanupAppScreenHtml(screen);
    assert.match(html, /opportunity_funnel_audit-20260721T120000Z\.jsonl/);
    assert.match(html, /Retained within policy/);
    assert.match(html, /Archive Storage/);
    assert.match(html, /0 days old/);
    assert.doesNotMatch(html, /<button/i);
    assert.doesNotMatch(html, /<form/i);
  } finally {
    rmSync(archiveDir, { recursive: true, force: true });
  }
});

test("server and navigation expose opportunity audit archive retention as read-only routes", () => {
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const navigation = readFileSync(new URL("../src/scanner/app_navigation_readonly.mjs", import.meta.url), "utf8");

  assert.match(server, /\/diagnostics\/opportunity-audit-archive-retention-preview/);
  assert.match(server, /\/app\/opportunity-audit-archive-retention/);
  assert.match(navigation, /opportunity_audit_archive_retention/);
  assert.match(navigation, /OPPORTUNITY_AUDIT_ARCHIVE_RETENTION_PREVIEW_READONLY/);
});
