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

test('two assurance monitors record one recovery and still retry an authorized failed delivery', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-assurance-recovery-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ledgerPath = path.join(dir, 'incident.jsonl');
  const failure = { source: 'paper_execution', category: 'paper_execution_assurance', failureCodes: ['TEST_STALL'] };
  let attempts = 0;
  const opts = { ledgerPath, env: {}, retryCooldownMs: 1000, delivery: { send: async () => ({ delivered: ++attempts > 1 }) } };
  const base = Date.parse('2026-11-16T18:00:00Z');
  const emit = (seconds, severity, process, send = false) => emitAdminPaperOperationalIncident(
    { ...failure, severity, process }, { ...opts, now: base + seconds * 1000, allowNotificationSend: send });
  await emit(0, 'critical', 'watchdog');
  assert.equal((await emit(1, 'recovery', 'scanner')).persistence.appended, true);
  const previous = fs.readFileSync(ledgerPath, 'utf8');
  assert.equal((await emit(10, 'recovery', 'watchdog')).persistence.appended, false);
  assert.equal(fs.readFileSync(ledgerPath, 'utf8'), previous);
  assert.equal(attempts, 0);
  assert.equal((await emit(11, 'recovery', 'watchdog', true)).delivery.delivered, false);
  assert.equal((await emit(11.5, 'recovery', 'scanner', true)).persistence.appended, false);
  assert.equal((await emit(13, 'recovery', 'scanner', true)).delivery.delivered, true);
  assert.equal((await emit(14, 'recovery', 'watchdog', true)).persistence.appended, false);
  assert.equal(attempts, 2);
  assert.equal((await emit(15, 'critical', 'scanner')).incident.open, true);
  assert.equal((await emit(16, 'recovery', 'watchdog')).persistence.appended, true);
});
