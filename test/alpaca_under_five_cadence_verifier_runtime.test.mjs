import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  collectCadenceVerifierInput,
  runUnderFiveCadenceVerifierOnce,
} from "../src/scanner/alpaca_under_five_cadence_verifier_runtime.mjs";

const healthyInput = {
  health: {
    status: "ok",
    degraded: false,
    issues: [],
    stream: { marketOpen: true },
  },
  pm2: [
    { name: "gemini-scanner", status: "online" },
  ],
  diagnostics: {
    version: "alpaca_under_five_shared_scan_cache_v3",
    broadScanCount: 1,
    focusedScanCount: 0,
    lastBroadScanAt: "2026-08-24T13:30:00.000Z",
    broadCandidateSymbols: ["AAA"],
    broadIntervalSec: 300,
    focusedIntervalSec: 15,
    lastError: null,
  },
};

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-cadence-runtime-"));
  return {
    dir,
    statePath: path.join(dir, "state.json"),
    ledgerPath: path.join(dir, "results.jsonl"),
  };
}

test("collector reads only local health, shared-cache diagnostics, and PM2 status", async () => {
  const routes = [];
  const input = await collectCadenceVerifierInput({
    http: {
      async getJson(route) {
        routes.push(route);
        if (route === "/health") return { ok: true, statusCode: 200, body: healthyInput.health };
        if (route === "/diagnostics/alpaca-under-five-shared-cache") {
          return { ok: true, statusCode: 200, body: { diagnostics: healthyInput.diagnostics } };
        }
        throw new Error(`unexpected route ${route}`);
      },
    },
    pm2: { async list() { return healthyInput.pm2; } },
  });

  assert.deepEqual(routes.sort(), [
    "/diagnostics/alpaca-under-five-shared-cache",
    "/health",
  ]);
  assert.deepEqual(input.health, healthyInput.health);
  assert.deepEqual(input.diagnostics, healthyInput.diagnostics);
  assert.deepEqual(input.pm2, healthyInput.pm2);
});

test("runtime persists state privately and never emails without explicit authorization", async () => {
  const { statePath, ledgerPath } = tempPaths();
  let sends = 0;

  const run = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:00.000Z"),
    input: healthyInput,
    statePath,
    ledgerPath,
    allowEmailSend: false,
    delivery: {
      async sendMessage() {
        sends += 1;
        return { delivered: true };
      },
    },
  });

  assert.equal(run.result.status, "collecting");
  assert.equal(run.alert.attempted, false);
  assert.equal(sends, 0);
  assert.equal(fs.statSync(statePath).mode & 0o777, 0o600);
  assert.equal(run.readOnly, true);
  assert.equal(run.remediationAllowed, false);
  assert.equal(run.brokerContactAllowed, false);
  assert.equal(run.orderPlacementAllowed, false);
  assert.equal(run.accountMutationAllowed, false);
  assert.equal(run.scannerLogicMutationAllowed, false);
  assert.equal(run.thresholdMutationAllowed, false);
  assert.equal(run.liveTradingAllowed, false);
});

test("terminal PASS sends at most one authorized admin notification across repeated cycles", async () => {
  const { statePath, ledgerPath } = tempPaths();
  let sends = 0;
  const delivery = {
    async sendMessage(message) {
      sends += 1;
      assert.match(message.subject, /\[GeminiScanner Cadence\] PASS/);
      return { delivered: true, provider: "test" };
    },
  };

  await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:00.000Z"),
    input: healthyInput,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });

  const focused = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      focusedScanCount: 3,
    },
  };
  await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:31:00.000Z"),
    input: focused,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });

  const focusedAgain = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      focusedScanCount: 6,
    },
  };
  await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:32:00.000Z"),
    input: focusedAgain,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });

  const passInput = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      broadScanCount: 2,
      focusedScanCount: 19,
      lastBroadScanAt: "2026-08-24T13:35:00.000Z",
    },
  };

  const firstPass = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:35:05.000Z"),
    input: passInput,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });
  assert.equal(firstPass.result.status, "pass");
  assert.equal(firstPass.alert.attempted, true);
  assert.equal(sends, 1);

  for (const [at, focusedScanCount] of [
    ["2026-08-24T13:35:20.000Z", 20],
    ["2026-08-24T13:35:35.000Z", 21],
    ["2026-08-24T13:35:50.000Z", 22],
  ]) {
    const repeatedPass = await runUnderFiveCadenceVerifierOnce({
      now: new Date(at),
      input: {
        ...passInput,
        diagnostics: {
          ...passInput.diagnostics,
          focusedScanCount,
        },
      },
      statePath,
      ledgerPath,
      allowEmailSend: true,
      delivery,
    });
    assert.equal(repeatedPass.result.status, "pass");
    assert.equal(repeatedPass.alert.attempted, false);
    assert.equal(repeatedPass.alert.reason, "terminal_result_already_notified");
    assert.equal(repeatedPass.ledger.appended, false);
    assert.equal(repeatedPass.ledger.reason, "terminal_result_already_recorded");
  }

  assert.equal(sends, 1);
  const ledgerRows = fs.readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean);
  assert.equal(ledgerRows.length, 1);
  const persistedState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(typeof persistedState.lastTerminalResultKey, "string");
  assert.equal(typeof persistedState.lastNotificationKey, "string");
  assert.equal(fs.statSync(ledgerPath).mode & 0o777, 0o600);
});

test("unauthorized terminal result remains eligible for one later authorized notification", async () => {
  const { statePath, ledgerPath } = tempPaths();
  let sends = 0;
  const delivery = {
    async sendMessage() {
      sends += 1;
      return { delivered: true, provider: "test" };
    },
  };
  const bad = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      focusedIntervalSec: 30,
    },
  };

  const unauthorized = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:00.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: false,
    delivery,
  });
  assert.equal(unauthorized.result.status, "fail");
  assert.equal(unauthorized.alert.reason, "email_send_not_authorized");
  assert.equal(sends, 0);

  let persistedState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(typeof persistedState.lastTerminalResultKey, "string");
  assert.equal(persistedState.lastNotificationKey, undefined);

  const authorized = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:15.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });
  assert.equal(authorized.result.status, "fail");
  assert.equal(authorized.alert.attempted, true);
  assert.equal(sends, 1);
  assert.equal(authorized.ledger.appended, false);
  assert.equal(authorized.ledger.reason, "terminal_result_already_recorded");

  const repeated = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:30.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });
  assert.equal(repeated.alert.attempted, false);
  assert.equal(repeated.alert.reason, "terminal_result_already_notified");
  assert.equal(sends, 1);

  const ledgerRows = fs.readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean);
  assert.equal(ledgerRows.length, 1);
  persistedState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(typeof persistedState.lastNotificationKey, "string");
});

test("terminal FAIL is recorded but email remains externally gated", async () => {
  const { statePath, ledgerPath } = tempPaths();
  let sends = 0;
  const bad = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      focusedIntervalSec: 30,
    },
  };

  const run = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:00.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: false,
    delivery: {
      async sendMessage() {
        sends += 1;
        return { delivered: true };
      },
    },
  });

  assert.equal(run.result.status, "fail");
  assert.equal(run.result.terminal, true);
  assert.equal(run.alert.attempted, false);
  assert.equal(run.alert.reason, "email_send_not_authorized");
  assert.equal(sends, 0);
  assert.equal(run.ledger.appended, true);
});


test("failed authorized cadence email is not marked notified and retries after 60-second cooldown", async () => {
  const { statePath, ledgerPath } = tempPaths();
  let sends = 0;
  const bad = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      focusedIntervalSec: 30,
    },
  };
  const delivery = {
    async sendMessage() {
      sends += 1;
      return { delivered: false, provider: "test", statusCode: 503, reason: "resend_delivery_failed" };
    },
  };

  const first = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:00.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });
  assert.equal(first.alert.attempted, true);
  assert.equal(first.alert.delivered, false);
  assert.equal(sends, 1);

  let persisted = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(persisted.lastNotificationKey, undefined);
  assert.equal(persisted.notificationAttemptCount, 1);
  assert.equal(typeof persisted.lastNotificationAttemptKey, "string");
  assert.equal(persisted.lastNotificationAttemptAt, "2026-08-24T13:30:00.000Z");

  const early = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:59.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });
  assert.equal(early.alert.attempted, false);
  assert.equal(early.alert.reason, "email_retry_cooldown");
  assert.equal(sends, 1);

  const retry = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:31:00.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });
  assert.equal(retry.alert.attempted, true);
  assert.equal(retry.alert.delivered, false);
  assert.equal(sends, 2);

  persisted = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(persisted.lastNotificationKey, undefined);
  assert.equal(persisted.notificationAttemptCount, 2);
});

test("cadence email delivery exception is contained sanitized and remains retryable", async () => {
  const { statePath, ledgerPath } = tempPaths();
  const bad = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      focusedIntervalSec: 30,
    },
  };

  const run = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:30:00.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery: {
      async sendMessage() {
        throw Object.assign(new Error("secret detail"), { code: "ETIMEDOUT" });
      },
    },
  });

  assert.equal(run.alert.attempted, true);
  assert.equal(run.alert.delivered, false);
  assert.equal(run.alert.reason, "notification_delivery_exception");
  assert.equal(run.alert.errorCode, "ETIMEDOUT");
  const raw = fs.readFileSync(statePath, "utf8");
  assert.doesNotMatch(raw, /secret detail/);
  const persisted = JSON.parse(raw);
  assert.equal(persisted.lastNotificationKey, undefined);
  assert.equal(persisted.notificationAttemptCount, 1);
});

test("failed cadence email stops after three attempts and successful retry deduplicates thereafter", async () => {
  const { statePath, ledgerPath } = tempPaths();
  let sends = 0;
  const bad = {
    ...healthyInput,
    diagnostics: {
      ...healthyInput.diagnostics,
      focusedIntervalSec: 30,
    },
  };
  const delivery = {
    async sendMessage() {
      sends += 1;
      return sends === 3
        ? { delivered: true, provider: "test", statusCode: 200 }
        : { delivered: false, provider: "test", statusCode: 503 };
    },
  };

  for (const at of [
    "2026-08-24T13:30:00.000Z",
    "2026-08-24T13:31:00.000Z",
    "2026-08-24T13:32:00.000Z",
  ]) {
    await runUnderFiveCadenceVerifierOnce({
      now: new Date(at),
      input: bad,
      statePath,
      ledgerPath,
      allowEmailSend: true,
      delivery,
    });
  }
  assert.equal(sends, 3);
  let persisted = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(typeof persisted.lastNotificationKey, "string");

  const dedup = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:33:00.000Z"),
    input: bad,
    statePath,
    ledgerPath,
    allowEmailSend: true,
    delivery,
  });
  assert.equal(dedup.alert.attempted, false);
  assert.equal(dedup.alert.reason, "terminal_result_already_notified");
  assert.equal(sends, 3);

  const exhaustedPaths = tempPaths();
  let failedSends = 0;
  const alwaysFail = {
    async sendMessage() {
      failedSends += 1;
      return { delivered: false, provider: "test", statusCode: 503 };
    },
  };
  for (const at of [
    "2026-08-24T13:30:00.000Z",
    "2026-08-24T13:31:00.000Z",
    "2026-08-24T13:32:00.000Z",
  ]) {
    await runUnderFiveCadenceVerifierOnce({
      now: new Date(at),
      input: bad,
      statePath: exhaustedPaths.statePath,
      ledgerPath: exhaustedPaths.ledgerPath,
      allowEmailSend: true,
      delivery: alwaysFail,
    });
  }
  const exhausted = await runUnderFiveCadenceVerifierOnce({
    now: new Date("2026-08-24T13:33:00.000Z"),
    input: bad,
    statePath: exhaustedPaths.statePath,
    ledgerPath: exhaustedPaths.ledgerPath,
    allowEmailSend: true,
    delivery: alwaysFail,
  });
  assert.equal(exhausted.alert.attempted, false);
  assert.equal(exhausted.alert.reason, "email_retry_exhausted");
  assert.equal(failedSends, 3);
});
