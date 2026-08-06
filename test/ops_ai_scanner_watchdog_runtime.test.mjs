import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildOpsAiScannerWatchdogAlert,
  createWatchdogFilesystemAdapter,
  runOpsAiScannerWatchdogOnce,
} from "../src/scanner/ops_ai_scanner_watchdog_runtime.mjs";

const NOW = new Date("2026-08-06T15:00:00.000Z");

function healthyInput() {
  return {
    health: { status: "ok", degraded: false, issues: [] },
    readiness: { ready: true, degraded: false, issues: [] },
    pm2: [
      { name: "gemini-scanner", status: "online" },
      { name: "gemini-paper-manual-watcher", status: "online" },
      { name: "gemini-dry-scanner", status: "stopped" },
    ],
    premarket: {
      running: true,
      schedulerState: "sleeping",
      session: { active: false },
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      scannerLogicMutationAlowed: false,
      thresholdMutationAllowed: false,
    },
    postMarket: {
      enabled: true,
      running: true,
      timerScheduled: true,
      lastStatus: "waiting_for_postmarket",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAlowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
    },
    backgroundAi: {
      enabled: true,
      running: true,
      intervalMs: 900000,
      lastStatus: "scheduled",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
      automaticLearningAllowed: false,
    },
    aiReviewRecords: [{
      provider: "openai",
      providerStatus: "completed_readonly",
      responseId: "resp_runtime_123",
      generatedAt: "2026-08-06T14:45:00.000Z",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
      automaticLearningAllowed: false,
    }],
    aiLedger: { available: true, writable: true, path: "runs/ai.jsonl" },
    incidentLedger: { available: true, writable: true, path: "runs/incidents.jsonl" },
    session: {
      premarketApplicable: false,
      postMarketEvidenceExpected: false,
      backgroundAiExpected: true,
    },
  };
}

test("runtime performs one read-only cycle without sending email", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-watchdog-runtime-"));
  const result = await runOpsAiScannerWatchdogOnce({
    now: NOW,
    input: healthyInput(),
    incidentLedgerPath: path.join(dir, "incidents.jsonl"),
    previousIncident: null,
    allowEmailSend: false,
  });
  assert.equal(result.report.healthy, true);
  assert.equal(result.alert.attempted, false);
  assert.equal(result.emailSendAuthorized, false);
  assert.equal(result.readOnly, true);
  assert.equal(result.remediationAllowed, false);
});

test("failure transition remains unsent without separate authorization", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-watchdog-runtime-"));
  const input = healthyInput();
  input.health.degraded = true;
  input.health.issues = ["STREAM_STALE"];
  const result = await runOpsAiScannerWatchdogOnce({
    now: NOW,
    input,
    incidentLedgerPath: path.join(dir, "incidents.jsonl"),
    previousIncident: null,
    allowEmailSend: false,
  });
  assert.equal(result.report.healthy, false);
  assert.equal(result.transition.transition, "failure_opened");
  assert.equal(result.transition.shouldAlert, true);
  assert.deepEqual(result.alert, {
    attempted: false,
    delivered: false,
    reason: "email_send_not_authorized",
  });
});

test("alert body is bounded and contains no secrets", () => {
  const message = buildOpsAiScannerWatchdogAlert({
    report: {
      generatedAt: NOW.toISOString(),
      status: "unhealthy",
      failureCount: 1,
      failureCodes: ["HEALTH_DEGRADED"],
    },
    transition: { transition: "failure_opened", alertKind: "failure" },
    recipient: "alerts@geminiscanner.net",
    sender: "GeminiScanner <verify@mail.geminiscanner.net>",
  });
  assert.equal(message.to, "alerts@geminiscanner.net");
  assert.match(message.subject, /FAILURE/);
  assert.match(message.text, /HEALTH_DEGRADED/);
  assert.equal(message.containsSecrets, false);
  assert.doesNotMatch(message.text, /api[_ -]?key|authorization:|bearer /i);
});

test("filesystem adapter creates local ledgers at 0600", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-watchdog-fs-"));
  const file = path.join(dir, "nested", "ledger.jsonl");
  const state = createWatchdogFilesystemAdapter().inspectFile(file);
  assert.equal(state.available, true);
  assert.equal(state.writable, true);
  assert.equal(state.mode, 0o600);
});
