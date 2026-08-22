import test from "node:test";
import assert from "node:assert/strict";
import {
  createCadenceVerifierState,
  observeUnderFiveCadence,
} from "../src/scanner/alpaca_under_five_cadence_verifier.mjs";

const pm2 = [
  { name: "gemini-scanner", status: "online" },
  { name: "gemini-dry-scanner", status: "stopped" },
];

function input({
  marketOpen = true,
  broadScanCount = 1,
  focusedScanCount = 0,
  lastBroadScanAt = "2026-08-24T13:30:00.000Z",
  broadCandidateSymbols = ["AAA", "BBB"],
  version = "alpaca_under_five_shared_scan_cache_v3",
  broadIntervalSec = 300,
  focusedIntervalSec = 15,
  lastError = null,
} = {}) {
  return {
    health: {
      status: "ok",
      degraded: false,
      issues: [],
      stream: { marketOpen },
    },
    pm2,
    diagnostics: {
      version,
      broadScanCount,
      focusedScanCount,
      lastBroadScanAt,
      broadCandidateSymbols,
      broadIntervalSec,
      focusedIntervalSec,
      lastError,
    },
  };
}

test("closed market waits without declaring cadence failure", () => {
  const result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({ marketOpen: false }),
    { now: new Date("2026-08-24T12:00:00.000Z") },
  );
  assert.equal(result.status, "waiting_for_market_open");
  assert.equal(result.terminal, false);
  assert.deepEqual(result.violations, []);
  assert.equal(result.readOnly, true);
  assert.equal(result.orderPlacementAllowed, false);
  assert.equal(result.brokerContactAllowed, false);
  assert.equal(result.accountMutationAllowed, false);
});

test("market-open evidence passes after a full broad interval and focused observations", () => {
  let result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({ broadScanCount: 1, focusedScanCount: 0 }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({ broadScanCount: 1, focusedScanCount: 5 }),
    { now: new Date("2026-08-24T13:31:15.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({ broadScanCount: 1, focusedScanCount: 10 }),
    { now: new Date("2026-08-24T13:33:00.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({
      broadScanCount: 2,
      focusedScanCount: 19,
      lastBroadScanAt: "2026-08-24T13:35:00.000Z",
    }),
    { now: new Date("2026-08-24T13:35:05.000Z") },
  );

  assert.equal(result.status, "pass");
  assert.equal(result.pass, true);
  assert.equal(result.terminal, true);
  assert.equal(result.evidence.broadObserved, 1);
  assert.equal(result.evidence.focusedObserved, 3);
  assert.deepEqual(result.violations, []);
});

test("broad scan occurring materially before five minutes fails", () => {
  let result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({ broadScanCount: 1, focusedScanCount: 0 }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({
      broadScanCount: 2,
      focusedScanCount: 1,
      lastBroadScanAt: "2026-08-24T13:30:15.000Z",
    }),
    { now: new Date("2026-08-24T13:30:16.000Z") },
  );

  assert.equal(result.status, "fail");
  assert.ok(result.violations.includes("BROAD_SCAN_TOO_FREQUENT"));
});

test("contract drift fails without mutating anything", () => {
  const result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({ focusedIntervalSec: 30 }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );
  assert.equal(result.status, "fail");
  assert.ok(result.violations.includes("FOCUSED_INTERVAL_MISMATCH"));
  assert.equal(result.remediationAllowed, false);
  assert.equal(result.scannerLogicMutationAllowed, false);
  assert.equal(result.thresholdMutationAllowed, false);
  assert.equal(result.liveTradingAllowed, false);
});

test("scanner and dry-scanner PM2 invariants are enforced", () => {
  const result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    {
      ...input(),
      pm2: [
        { name: "gemini-scanner", status: "stopped" },
        { name: "gemini-dry-scanner", status: "online" },
      ],
    },
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );
  assert.equal(result.status, "fail");
  assert.ok(result.violations.includes("SCANNER_NOT_ONLINE"));
  assert.ok(result.violations.includes("DRY_SCANNER_NOT_STOPPED"));
});

test("market close resets session evidence before the next open baseline", () => {
  let result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({ marketOpen: true, broadScanCount: 1, focusedScanCount: 0 }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({ marketOpen: true, broadScanCount: 1, focusedScanCount: 1 }),
    { now: new Date("2026-08-24T13:30:15.000Z") },
  );
  assert.equal(result.evidence.focusedObserved, 1);

  result = observeUnderFiveCadence(
    result.state,
    input({ marketOpen: false, broadScanCount: 1, focusedScanCount: 1 }),
    { now: new Date("2026-08-24T20:01:00.000Z") },
  );
  assert.equal(result.status, "waiting_for_market_open");
  assert.equal(result.state.marketWasOpen, false);
  assert.equal(result.state.startedAt, null);
  assert.equal(result.state.broadEvents.length, 0);
  assert.equal(result.state.focusedEvents.length, 0);
  assert.deepEqual(result.state.violations, []);

  result = observeUnderFiveCadence(
    result.state,
    input({ marketOpen: true, broadScanCount: 9, focusedScanCount: 40 }),
    { now: new Date("2026-08-25T13:30:00.000Z") },
  );
  assert.equal(result.status, "collecting");
  assert.equal(result.evidence.broadObserved, 0);
  assert.equal(result.evidence.focusedObserved, 0);
  assert.deepEqual(result.violations, []);
});

test("focused refresh cannot mutate the broad-discovery cohort", () => {
  let result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({
      broadScanCount: 1,
      focusedScanCount: 0,
      broadCandidateSymbols: ["AAA", "BBB"],
    }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({
      broadScanCount: 1,
      focusedScanCount: 1,
      broadCandidateSymbols: ["AAA"],
    }),
    { now: new Date("2026-08-24T13:30:15.000Z") },
  );

  assert.equal(result.status, "fail");
  assert.ok(result.violations.includes("FOCUSED_COHORT_MUTATED"));
});

test("non-empty broad cohort fails when focused scan count stalls", () => {
  let result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({
      broadScanCount: 1,
      focusedScanCount: 0,
      broadCandidateSymbols: ["AAA"],
    }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({
      broadScanCount: 1,
      focusedScanCount: 0,
      broadCandidateSymbols: ["AAA"],
    }),
    { now: new Date("2026-08-24T13:30:46.000Z") },
  );

  assert.equal(result.status, "fail");
  assert.ok(result.violations.includes("FOCUSED_SCAN_STALLED"));
});

test("focused stall accumulates across normal fifteen-second observations", () => {
  let result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({
      broadScanCount: 1,
      focusedScanCount: 0,
      broadCandidateSymbols: ["AAA"],
    }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );

  for (const at of [
    "2026-08-24T13:30:15.000Z",
    "2026-08-24T13:30:30.000Z",
  ]) {
    result = observeUnderFiveCadence(
      result.state,
      input({
        broadScanCount: 1,
        focusedScanCount: 0,
        broadCandidateSymbols: ["AAA"],
      }),
      { now: new Date(at) },
    );
    assert.equal(result.status, "collecting");
    assert.ok(!result.violations.includes("FOCUSED_SCAN_STALLED"));
  }

  result = observeUnderFiveCadence(
    result.state,
    input({
      broadScanCount: 1,
      focusedScanCount: 0,
      broadCandidateSymbols: ["AAA"],
    }),
    { now: new Date("2026-08-24T13:30:45.000Z") },
  );

  assert.equal(result.status, "fail");
  assert.ok(result.violations.includes("FOCUSED_SCAN_STALLED"));
});

test("empty broad cohort is not a focused-stall failure and remains insufficient evidence", () => {
  let result = observeUnderFiveCadence(
    createCadenceVerifierState(),
    input({
      broadScanCount: 1,
      focusedScanCount: 0,
      broadCandidateSymbols: [],
    }),
    { now: new Date("2026-08-24T13:30:00.000Z") },
  );

  result = observeUnderFiveCadence(
    result.state,
    input({
      broadScanCount: 1,
      focusedScanCount: 0,
      broadCandidateSymbols: [],
    }),
    { now: new Date("2026-08-24T13:31:00.000Z") },
  );
  assert.equal(result.status, "collecting");
  assert.ok(!result.violations.includes("FOCUSED_SCAN_STALLED"));

  result = observeUnderFiveCadence(
    result.state,
    input({
      broadScanCount: 2,
      focusedScanCount: 0,
      broadCandidateSymbols: [],
      lastBroadScanAt: "2026-08-24T13:35:00.000Z",
    }),
    { now: new Date("2026-08-24T13:35:05.000Z") },
  );

  assert.equal(result.status, "insufficient_focused_evidence");
  assert.equal(result.terminal, false);
  assert.equal(result.evidence.broadObserved, 1);
  assert.equal(result.evidence.focusedObserved, 0);
  assert.equal(result.evidence.focusedEvidenceRequired, false);
  assert.deepEqual(result.violations, []);
});
