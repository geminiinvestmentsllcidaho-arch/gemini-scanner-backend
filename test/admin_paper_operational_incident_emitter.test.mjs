import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emitAdminPaperOperationalIncident } from "../src/scanner/admin_paper_operational_incident_emitter.mjs";
test("persists PAPER reconciliation incident and does not send by default", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-paper-incident-"));
  const ledgerPath = path.join(dir, "incidents.jsonl");
  try {
    let sends = 0;
    const result = await emitAdminPaperOperationalIncident({ source: "paper_reconciliation", failureCode: "paper_exit_matching_lifecycle_not_found", summary: "PAPER preparation mismatch" }, { ledgerPath, env: {}, delivery: { send: async () => { sends += 1; return { delivered: true }; } } });
    assert.equal(sends, 0);
    assert.equal(result.incident.category, "paper_reconciliation");
    assert.equal(result.incident.containsSecrets, false);
    assert.equal(fs.statSync(ledgerPath).mode & 0o777, 0o600);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("authorized PAPER incident uses injected Admin delivery without operational mutation", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-paper-incident-"));
  const ledgerPath = path.join(dir, "incidents.jsonl");
  try {
    const sent = [];
    const result = await emitAdminPaperOperationalIncident({ source: "paper_execution", failureCode: "paper_auto_submission_rejected", summary: "PAPER submission rejected" }, { ledgerPath, allowNotificationSend: true, delivery: { send: async (n) => { sent.push(n); return { delivered: true, provider: "test" }; } } });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].source, "paper_execution");
    assert.equal(result.delivery.delivered, true);
    assert.equal(result.brokerContactPerformed, false);
    assert.equal(result.orderActionPerformed, false);
    assert.equal(result.accountMutationPerformed, false);
    assert.equal(result.liveTradingActionPerformed, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
