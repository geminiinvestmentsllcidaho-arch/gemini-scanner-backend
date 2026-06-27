import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PAPER_TRADE_INTENT_AUDIT_STORE_VERSION,
  appendPaperTradeIntentAuditRecord,
  createPaperTradeIntentAuditRecord,
  getPaperTradeIntentAuditSummary,
  readPaperTradeIntentAuditRecords,
  recordPaperTradeIntentSnapshot,
} from "../src/scanner/paper_trade_intent_audit_store.mjs";

function tempAuditPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "paper-intent-audit-")), "audit.jsonl");
}

test("paper trade intent audit records are monitor-only and execution-safe", () => {
  const record = createPaperTradeIntentAuditRecord({
    source: "unit_test",
    status: "blocked",
    reasons: ["readiness_gate_blocked", "entry_price_missing"],
    dashboardSnapshot: {
      ok: true,
      canCreateIntent: false,
      paperTradeIntentStatus: "blocked",
    },
    nowIso: "2026-06-26T00:00:00.000Z",
  });

  assert.equal(record.ok, true);
  assert.equal(record.version, PAPER_TRADE_INTENT_AUDIT_STORE_VERSION);
  assert.equal(record.monitorOnly, true);
  assert.equal(record.safety.noOrderPlacement, true);
  assert.equal(record.safety.noLiveTrading, true);
  assert.equal(record.safety.noAutoTrading, true);
  assert.equal(record.safety.noBrokerExecution, true);
  assert.equal(record.safety.noAccountMutation, true);
  assert.equal(record.status, "blocked");
  assert.deepEqual(record.reasons, ["readiness_gate_blocked", "entry_price_missing"]);
});

test("paper trade intent audit store appends and reads jsonl records", () => {
  const auditPath = tempAuditPath();

  const first = createPaperTradeIntentAuditRecord({
    source: "unit_test",
    status: "blocked",
    reasons: ["candidate_symbol_missing"],
    nowIso: "2026-06-26T00:00:00.000Z",
  });

  const second = createPaperTradeIntentAuditRecord({
    source: "unit_test",
    status: "ready",
    reasons: [],
    nowIso: "2026-06-26T00:01:00.000Z",
  });

  appendPaperTradeIntentAuditRecord(first, { auditPath });
  appendPaperTradeIntentAuditRecord(second, { auditPath });

  const readResult = readPaperTradeIntentAuditRecords({ auditPath, limit: 10 });

  assert.equal(readResult.ok, true);
  assert.equal(readResult.exists, true);
  assert.equal(readResult.totalRecords, 2);
  assert.equal(readResult.malformedRecords, 0);
  assert.equal(readResult.records.length, 2);
  assert.equal(readResult.records[0].status, "blocked");
  assert.equal(readResult.records[1].status, "ready");
});

test("paper trade intent audit summary exposes latest status without mutating accounts", () => {
  const auditPath = tempAuditPath();

  recordPaperTradeIntentSnapshot({
    auditPath,
    source: "unit_test",
    dashboardSnapshot: {
      readinessGateStatus: "blocked",
      paperTradeIntentStatus: "blocked",
      blockReasons: ["readiness_gate_blocked"],
    },
    nowIso: "2026-06-26T00:00:00.000Z",
  });

  const summary = getPaperTradeIntentAuditSummary({ auditPath, limit: 5 });

  assert.equal(summary.ok, true);
  assert.equal(summary.monitorOnly, true);
  assert.equal(summary.totalRecords, 1);
  assert.equal(summary.latestStatus, "blocked");
  assert.deepEqual(summary.latestReasons, ["readiness_gate_blocked"]);
  assert.equal(summary.safety.noBrokerExecution, true);
  assert.equal(summary.safety.noAccountMutation, true);
});

test("paper trade intent audit reader tolerates missing files", () => {
  const auditPath = path.join(os.tmpdir(), `missing-paper-intent-audit-${Date.now()}.jsonl`);

  const readResult = readPaperTradeIntentAuditRecords({ auditPath });

  assert.equal(readResult.ok, true);
  assert.equal(readResult.exists, false);
  assert.equal(readResult.totalRecords, 0);
  assert.deepEqual(readResult.records, []);
});
