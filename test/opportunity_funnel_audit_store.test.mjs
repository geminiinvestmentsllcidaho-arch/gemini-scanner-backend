import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendOpportunityFunnelAuditRecord,
  buildOpportunityFunnelAuditRecord,
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
        blockingFlags: [],
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
