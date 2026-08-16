import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendOpportunityFunnelAuditRecord,
  buildOpportunityFunnelAuditRecord,
  rotateOpportunityFunnelAuditIfNeeded,
  inspectOpportunityFunnelAuditArchiveRetention,
  listOpportunityFunnelAuditRecords,
  listOpportunityFunnelAuditRecordsFiltered,
} from "../src/scanner/opportunity_funnel_audit_store.mjs";

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-opportunity-funnel-"));
  return {
    dir,
    auditPath: path.join(dir,"audit.jsonl"),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("builds deterministic read-only opportunity funnel scan records", () => {
  const record = buildOpportunityFunnelAuditRecord({
    scanId: "scan-1",
    scanType: "premarket",
    sourceVersion: "fixture_v1",
    sourceStatus: "connected_readonly",
    marketOpen: true,
    assetCount: 3,
    snapshotCount: 3,
    candidates: [
      {
        symbol: "aaa",
        price: 4.5,
        premarketGapPct: 6.2,
        readonlyPotentialScore: 82,
        decision: "ENTER",
        resultState: "ENTER",
        blockingFlags: [],
        staleReasons: [],
        sourceStale: false,
        rankingConnected: true,
        rankingP3GateOk: true,
        rankingSetupScore: 82,
        rankingConfidence: 0.8,
        rankingQuality: 0.9,
      },
      {
        symbol: "bbb",
        price: 3.1,
        readonlyPotentialScore: 61,
        decision: "WAIT",
        blockingFlags: [],
      },
      {
        symbol: "ccc",
        price: 2.2,
        readonlyPotentialScore: 39,
        decision: "DO_NOT_ENTER",
        blockingFlags: ["wide_spread"],
      },
    ],
  }, {
    now: new Date("2026-07-16T15:45:00.000Z"),
  });

  assert.equal(record.eventAt, "2026-07-16T15:45:00.000Z");
  assert.equal(record.candidateCount, 3);
  assert.equal(record.scanType, "premarket");
  assert.equal(record.candidates[0].premarketGapPct, 6.2);
  assert.deepEqual(record.decisionCounts, {
    ENTER: 1,
    WAIT: 1,
    DO_NOT_ENTER: 1,
  });
  assert.equal(record.candidates[0].symbol, "AAA");
  assert.equal(record.candidates[0].rankingP3GateOk, true);
  assert.equal(record.candidates[0].strategyAuthorization.version, "paper_auto_execution_strategy_authorization_v1");
  assert.equal(record.candidates[0].strategyAuthorization.authorized, true);
  assert.deepEqual(record.candidates[0].strategyAuthorization.blockers, []);
  assert.equal(record.candidates[0].strategyAuthorization.symbolLevelOnly, true);
  assert.equal(record.candidates[0].strategyAuthorization.portfolioRootAuthorizationUsed, false);
  assert.equal(record.candidates[0].strategyAuthorization.paperOnly, true);
  assert.equal(record.readOnly, true);
  assert.equal(record.paperOnly, true);
  assert.equal(record.orderPlacementAllowed, false);
  assert.equal(record.accountMutationAllowed, false);
  assert.equal(Object.isFrozen(record), true);
});

test("appends private jsonl records and reads newest first", () => {
  const f = fixture();
  try {
    appendOpportunityFunnelAuditRecord(
      { scanId: "scan-1", candidates: [] },
      { auditPath: f.auditPath, now: new Date("2026-07-16T15:45:00.000Z") },
    );
    appendOpportunityFunnelAuditRecord(
      { scanId: "scan-2", candidates: [{ symbol: "XYZ", decision: "WAIT" }] },
      { auditPath: f.auditPath, now: new Date("2026-07-16T15:46:00.000Z") },
    );

    const records = listOpportunityFunnelAuditRecords({ auditPath: f.auditPath });
    assert.equal(records.length, 2);
    assert.equal(records[0].scanId, "scan-2");
    assert.equal(records[1].scanId, "scan-1");
    assert.equal(fs.statSync(f.auditPath).mode & 0o777, 0o600);
  } finally {
    f.cleanup();
  }
});

test("returns an immutable empty list when the audit file does not exist", () => {
  const f = fixture();
  try {
    const records = listOpportunityFunnelAuditRecords({ auditPath: f.auditPath });
    assert.deepEqual(records, []);
    assert.equal(Object.isFrozen(records), true);
  } finally {
    f.cleanup();
  }
});


test("filtered reader finds older matching records beyond newer unrelated records", () => {
  const f = fixture();
  try {
    for (let index = 1; index <= 3; index += 1) {
      appendOpportunityFunnelAuditRecord({
        scanId: `premarket-${index}`,
        scanner: "alpaca_premarket_shared_readonly",
        scanType: "premarket",
        candidates: [{ symbol: `PM${index}`, decision: "WAIT" }],
      }, {
        auditPath: f.auditPath,
        now: new Date(`2026-07-20T12:0${index}:00.000Z`),
      });
    }

    for (let index = 0; index < 1200; index += 1) {
      appendOpportunityFunnelAuditRecord({
        scanId: `under-five-${index}`,
        scanner: "alpaca_under_five_shared",
        scanType: "under_five",
        candidates: [],
      }, {
        auditPath: f.auditPath,
        now: new Date(2026, 6, 20, 13, 0, 0, index),
      });
    }

    const records = listOpportunityFunnelAuditRecordsFiltered({
      auditPath: f.auditPath,
      maxRecords: 3,
      scanner: "alpaca_premarket_shared_readonly",
      scanType: "premarket",
      chunkSize: 4096,
    });

    assert.deepEqual(records.map((record) => record.scanId), [
      "premarket-3",
      "premarket-2",
      "premarket-1",
    ]);
    assert.equal(Object.isFrozen(records), true);
  } finally {
    f.cleanup();
  }
});


test("bounds persisted candidate payload independently from aggregate decision counts", () => {
  const candidates = Array.from({ length: 80 }, (_, index) => ({
    symbol: `T${index}`,
    decision: index % 2 === 0 ? "WAIT" : "DO_NOT_ENTER",
  }));
  const record = buildOpportunityFunnelAuditRecord(
    { scanId: "bounded-candidates", candidates },
    { now: new Date("2026-07-20T12:00:00.000Z"), maxCandidates: 50 },
  );

  assert.equal(record.candidateCount, 80);
  assert.equal(record.candidates.length, 50);
  assert.deepEqual(record.decisionCounts, { WAIT: 40, DO_NOT_ENTER: 40 });
});

test("rotates an oversized active audit file before appending the next record", () => {
  const f = fixture();
  const archiveDir = path.join(f.dir, "archive");
  try {
    appendOpportunityFunnelAuditRecord(
      { scanId: "before-rotation", candidates: [{ symbol: "OLD", decision: "WAIT" }] },
      { auditPath: f.auditPath, archiveDir, maxFileBytes: 1024 * 1024, now: new Date("2026-07-20T12:00:00.000Z") },
    );
    const result = appendOpportunityFunnelAuditRecord(
      { scanId: "after-rotation", candidates: [{ symbol: "NEW", decision: "WAIT" }] },
      { auditPath: f.auditPath, archiveDir, maxFileBytes: 1, now: new Date("2026-07-20T12:01:00.000Z") },
    );
    assert.equal(result.rotation.rotated, true);
    assert.equal(result.rotation.reason, "size_threshold_reached");
    const archiveFiles = fs.readdirSync(archiveDir);
    assert.equal(archiveFiles.length, 1);
    assert.match(archiveFiles[0], /^audit-20260720T120100000Z\.jsonl$/);
    const archived = listOpportunityFunnelAuditRecords({ auditPath: path.join(archiveDir, archiveFiles[0]) });
    const active = listOpportunityFunnelAuditRecords({ auditPath: f.auditPath });
    assert.deepEqual(archived.map((record) => record.scanId), ["before-rotation"]);
    assert.deepEqual(active.map((record) => record.scanId), ["after-rotation"]);
    assert.equal(fs.statSync(archiveDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(archiveDir, archiveFiles[0])).mode & 0o777, 0o600);
    assert.equal(fs.statSync(f.auditPath).mode & 0o777, 0o600);
  } finally { f.cleanup(); }
});

test("rotation helper leaves files below the configured threshold unchanged", () => {
  const f = fixture();
  try {
    appendOpportunityFunnelAuditRecord(
      { scanId: "small-file", candidates: [] },
      { auditPath: f.auditPath, now: new Date("2026-07-20T12:00:00.000Z") },
    );
    const result = rotateOpportunityFunnelAuditIfNeeded({
      auditPath: f.auditPath,
      archiveDir: path.join(f.dir, "archive"),
      maxFileBytes: 1024 * 1024,
      now: new Date("2026-07-20T12:01:00.000Z"),
    });
    assert.equal(result.rotated, false);
    assert.equal(result.reason, "below_size_threshold");
    assert.equal(fs.existsSync(f.auditPath), true);
    assert.equal(fs.existsSync(path.join(f.dir, "archive")), false);
  } finally { f.cleanup(); }
});

test("unfiltered reader discards a leading partial JSON line at the byte boundary", () => {
  const f = fixture();
  try {
    for (let index = 0; index < 12; index += 1) {
      appendOpportunityFunnelAuditRecord({
        scanId: `bounded-${index}`,
        scanner: "alpaca_under_five_shared",
        scanType: "under_five",
        candidates: Array.from({ length: 1 }, (_, item) => ({
          symbol: `B${item}`,
          decision: "WAIT",
          blockingFlags: ["partial-line-boundary-fixture"],
        })),
      }, {
        auditPath: f.auditPath,
        now: new Date(2026, 6, 20, 13, 0, 0, index),
      });
    }

    const records = listOpportunityFunnelAuditRecords({
      auditPath: f.auditPath,
      maxRecords: 3,
      chunkSize: 4096,
      maxBytesRead: 8192,
    });

    assert.deepEqual(records.map((record) => record.scanId), [
      "bounded-11",
      "bounded-10",
      "bounded-9",
    ]);
    assert.equal(Object.isFrozen(records), true);
  } finally {
    f.cleanup();
  }
});

test("unfiltered reader preserves a complete line when the byte boundary starts after a newline", () => {
  const f = fixture();
  try {
    const older = `${JSON.stringify({
      version: "opportunity_funnel_audit_store_v1",
      scanId: "older",
      generatedAt: "2026-07-20T12:00:00.000Z",
      candidates: [],
    })}\n`;
    const newer = `${JSON.stringify({
      version: "opportunity_funnel_audit_store_v1",
      scanId: "newer",
      generatedAt: "2026-07-20T12:01:00.000Z",
      candidates: [],
    })}\n`;
    fs.writeFileSync(f.auditPath, older + newer, { mode: 0o600 });

    const records = listOpportunityFunnelAuditRecords({
      auditPath: f.auditPath,
      maxRecords: 10,
      chunkSize: 4096,
      maxBytesRead: Buffer.byteLength(newer),
    });

    assert.deepEqual(records.map((record) => record.scanId), ["newer"]);
  } finally {
    f.cleanup();
  }
});

test("unfiltered reader surfaces malformed complete JSONL records", () => {
  const f = fixture();
  try {
    const valid = `${JSON.stringify({
      version: "opportunity_funnel_audit_store_v1",
      scanId: "valid",
      generatedAt: "2026-07-20T12:00:00.000Z",
      candidates: [],
    })}\n`;
    fs.writeFileSync(f.auditPath, `${valid}{malformed-json}\n`, { mode: 0o600 });

    assert.throws(
      () => listOpportunityFunnelAuditRecords({
        auditPath: f.auditPath,
        maxRecords: 10,
        chunkSize: 4096,
        maxBytesRead: 4096,
      }),
      SyntaxError,
    );
  } finally {
    f.cleanup();
  }
});

test("filtered reader preserves a complete matching line at an exact byte boundary", () => {
  const f = fixture();
  try {
    const older = `${JSON.stringify({
      version: "opportunity_funnel_audit_store_v1",
      scanId: "older",
      scanner: "other_scanner",
      scanType: "other",
      generatedAt: "2026-07-20T12:00:00.000Z",
      candidates: [],
    })}\n`;
    const newer = `${JSON.stringify({
      version: "opportunity_funnel_audit_store_v1",
      scanId: "newer",
      scanner: "alpaca_under_five_shared",
      scanType: "under_five",
      generatedAt: "2026-07-20T12:01:00.000Z",
      candidates: [],
    })}\n`;
    fs.writeFileSync(f.auditPath, older + newer, { mode: 0o600 });

    const records = listOpportunityFunnelAuditRecordsFiltered({
      auditPath: f.auditPath,
      scanner: "alpaca_under_five_shared",
      scanType: "under_five",
      maxRecords: 10,
      chunkSize: 4096,
      maxBytesRead: Buffer.byteLength(newer),
    });

    assert.deepEqual(records.map((record) => record.scanId), ["newer"]);
  } finally {
    f.cleanup();
  }
});

test("filtered reader surfaces malformed complete JSONL records", () => {
  const f = fixture();
  try {
    const valid = `${JSON.stringify({
      version: "opportunity_funnel_audit_store_v1",
      scanId: "valid",
      scanner: "alpaca_under_five_shared",
      scanType: "under_five",
      generatedAt: "2026-07-20T12:00:00.000Z",
      candidates: [],
    })}\n`;
    fs.writeFileSync(f.auditPath, `${valid}{malformed-json}\n`, { mode: 0o600 });

    assert.throws(
      () => listOpportunityFunnelAuditRecordsFiltered({
        auditPath: f.auditPath,
        scanner: "alpaca_under_five_shared",
        scanType: "under_five",
        maxRecords: 10,
        chunkSize: 4096,
        maxBytesRead: 4096,
      }),
      SyntaxError,
    );
  } finally {
    f.cleanup();
  }
});

test("filtered reader stops at the configured byte boundary", () => {
  const f = fixture();
  try {
    appendOpportunityFunnelAuditRecord({
      scanId: "older-premarket",
      scanner: "alpaca_premarket_shared_readonly",
      scanType: "premarket",
      candidates: [{ symbol: "OLD", decision: "WAIT" }],
    }, {
      auditPath: f.auditPath,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });

    for (let index = 0; index < 80; index += 1) {
      appendOpportunityFunnelAuditRecord({
        scanId: `newer-under-five-${index}`,
        scanner: "alpaca_under_five_shared",
        scanType: "under_five",
        candidates: Array.from({ length: 20 }, (_, item) => ({
          symbol: `U${item}`,
          decision: "WAIT",
          blockingFlags: ["bounded-reader-fixture"],
        })),
      }, {
        auditPath: f.auditPath,
        now: new Date(2026, 6, 20, 13, 0, 0, index),
      });
    }

    const records = listOpportunityFunnelAuditRecordsFiltered({
      auditPath: f.auditPath,
      maxRecords: 1,
      scanner: "alpaca_premarket_shared_readonly",
      scanType: "premarket",
      chunkSize: 4096,
      maxBytesRead: 4096,
    });

    assert.deepEqual(records, []);
    assert.equal(Object.isFrozen(records), true);
  } finally {
    f.cleanup();
  }
});


test("archive retention preview is immutable and mutation-disabled when the archive directory is missing", () => {
  const f = fixture();
  try {
    const result = inspectOpportunityFunnelAuditArchiveRetention({
      archiveDir: path.join(f.dir, "missing-archive"),
      now: new Date("2026-07-21T12:00:00.000Z"),
    });

    assert.equal(result.status, "archive_directory_missing");
    assert.equal(result.archiveCount, 0);
    assert.equal(result.candidateCount, 0);
    assert.deepEqual(result.candidates, []);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.candidates), true);
    assert.equal(result.cleanupDeletionAllowed, false);
    assert.equal(result.cleanupExecutionAllowed, false);
    assert.equal(result.readOnly, true);
    assert.equal(result.localStoreOnly, true);
  } finally {
    f.cleanup();
  }
});

test("archive retention preview selects oldest archives for count and byte pressure", () => {
  const f = fixture();
  const archiveDir = path.join(f.dir, "archive");
  fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });

  try {
    const fixtures = [
      ["opportunity_funnel_audit-newest.jsonl", "2026-07-21T11:00:00.000Z"],
      ["opportunity_funnel_audit-middle.jsonl", "2026-07-21T10:00:00.000Z"],
      ["opportunity_funnel_audit-oldest.jsonl", "2026-07-21T09:00:00.000Z"],
    ];
    for (const [name, timestamp] of fixtures) {
      const filePath = path.join(archiveDir, name);
      fs.writeFileSync(filePath, "1234567890", { mode: 0o600 });
      const date = new Date(timestamp);
      fs.utimesSync(filePath, date, date);
    }

    const result = inspectOpportunityFunnelAuditArchiveRetention({
      archiveDir,
      now: new Date("2026-07-21T12:00:00.000Z"),
      retentionDays: 30,
      maxArchives: 2,
      maxTotalBytes: 20,
    });

    assert.equal(result.status, "retention_cleanup_candidates_detected_read_only");
    assert.equal(result.archiveCount, 3);
    assert.equal(result.totalBytes, 30);
    assert.equal(result.candidateCount, 1);
    assert.equal(result.candidates[0].name, "opportunity_funnel_audit-oldest.jsonl");
    assert.deepEqual(result.candidates[0].reasons, [
      "archive_count_limit_exceeded",
      "archive_byte_limit_exceeded",
    ]);
    assert.equal(result.candidates[0].previewOnly, true);
    assert.equal(result.candidates[0].wouldDelete, false);
    assert.equal(result.cleanupDeletionAllowed, false);
    assert.equal(result.cleanupExecutionAllowed, false);
  } finally {
    f.cleanup();
  }
});

test("archive retention preview reports age pressure without deleting files", () => {
  const f = fixture();
  const archiveDir = path.join(f.dir, "archive");
  fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });

  try {
    const filePath = path.join(
      archiveDir,
      "opportunity_funnel_audit-20260601T120000000Z.jsonl",
    );
    fs.writeFileSync(filePath, "{}\n", { mode: 0o600 });
    const oldDate = new Date("2026-06-01T12:00:00.000Z");
    fs.utimesSync(filePath, oldDate, oldDate);

    const result = inspectOpportunityFunnelAuditArchiveRetention({
      archiveDir,
      now: new Date("2026-07-21T12:00:00.000Z"),
      retentionDays: 30,
      maxArchives: 30,
      maxTotalBytes: 1024,
    });

    assert.equal(result.candidateCount, 1);
    assert.deepEqual(result.candidates[0].reasons, [
      "older_than_retention_days",
    ]);
    assert.equal(fs.existsSync(filePath), true);
    assert.equal(result.cleanupDeletionAllowed, false);
    assert.equal(result.cleanupExecutionAllowed, false);
  } finally {
    f.cleanup();
  }
});
