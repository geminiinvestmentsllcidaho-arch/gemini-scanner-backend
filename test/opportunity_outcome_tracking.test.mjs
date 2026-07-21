import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  VERSION,
  buildOpportunityOutcomeTrackingReport,
  readOpportunityOutcomeTrackingReport,
} from "../src/scanner/opportunity_outcome_tracking.mjs";

function record(scanId, eventAt, candidates, marketOpen = true) {
  return {
    scanId,
    eventAt,
    marketOpen,
    candidates,
  };
}


test("read helper fails closed when the opportunity audit contains a malformed complete record", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-outcome-strict-reader-"));
  const auditPath = path.join(dir, "opportunity.jsonl");
  const valid = JSON.stringify(record(
    "scan-valid",
    "2026-07-20T14:00:00.000Z",
    [{ symbol: "ABC", price: 10, decision: "ENTER" }],
  ));
  fs.writeFileSync(auditPath, `${valid}\n{malformed-json}\n`, { mode: 0o600 });

  assert.throws(
    () => readOpportunityOutcomeTrackingReport({ auditPath, maxRecords: 20 }),
    SyntaxError,
  );
});

test("tracks later prices without mutating scanner decisions", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("scan-1", "2026-07-16T14:00:00.000Z", [
      {
        symbol: "ABC",
        price: 10,
        decision: "ENTER",
        resultState: "READY",
        readonlyPotentialScore: 80,
        rankingConfidence: 0.82,
      },
      {
        symbol: "XYZ",
        price: 20,
        decision: "WAIT",
        blockingFlags: ["wide_spread"],
      },
    ]),
    record("scan-2", "2026-07-16T14:00:15.000Z", [
      { symbol: "ABC", price: 11 },
      { symbol: "XYZ", price: 19 },
    ]),
    record("scan-3", "2026-07-16T14:00:30.000Z", [
      { symbol: "ABC", price: 9 },
      { symbol: "XYZ", price: 22 },
    ]),
  ], {
    horizonScans: 2,
    now: "2026-07-16T15:00:00.000Z",
  });

  assert.equal(report.version, VERSION);
  assert.equal(report.sourceRecordCount, 3);
  assert.equal(report.outcomeCount, 6);
  assert.equal(report.observedOutcomeCount, 4);
  assert.equal(report.pendingOutcomeCount, 2);

  const abc = report.outcomes.find(
    (row) => row.originScanId === "scan-1" && row.symbol === "ABC",
  );
  assert.equal(abc.entryPrice, 10);
  assert.equal(abc.latestPrice, 9);
  assert.equal(abc.latestReturnPct, -10);
  assert.equal(abc.maxFavorablePct, 10);
  assert.equal(abc.maxAdversePct, -10);
  assert.equal(abc.observations, 2);
  assert.equal(abc.decision, "ENTER");

  assert.equal(report.scannerLogicMutationAllowed, false);
  assert.equal(report.thresholdMutationAllowed, false);
  assert.equal(report.orderPlacementAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});

test("supports decision filtering and leaves missing future prices pending", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("scan-1", "2026-07-16T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER" },
      { symbol: "XYZ", price: 20, decision: "WAIT" },
    ]),
    record("scan-2", "2026-07-16T14:00:15.000Z", [
      { symbol: "XYZ", price: 21 },
    ]),
  ], {
    minDecision: "ENTER",
    horizonScans: 1,
  });

  assert.equal(report.outcomeCount, 1);
  assert.equal(report.observedOutcomeCount, 0);
  assert.equal(report.pendingOutcomeCount, 1);
  assert.equal(report.outcomes[0].latestPrice, null);
  assert.equal(report.outcomes[0].latestReturnPct, null);
});

test("sorts records chronologically before calculating outcomes", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("scan-2", "2026-07-16T14:00:15.000Z", [
      { symbol: "ABC", price: 12, decision: "ENTER" },
    ]),
    record("scan-1", "2026-07-16T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER" },
    ]),
  ], {
    horizonScans: 1,
  });

  const first = report.outcomes.find((row) => row.originScanId === "scan-1");
  assert.equal(first.latestPrice, 12);
  assert.equal(first.latestReturnPct, 20);
});

test("keeps market-closed scans pending instead of scoring flat prices", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("closed-1", "2026-07-17T00:30:00.000Z", [
      { symbol: "ABC", price: 10, decision: "DO_NOT_ENTER" },
    ], false),
    record("closed-2", "2026-07-17T00:30:30.000Z", [
      { symbol: "ABC", price: 10, decision: "DO_NOT_ENTER" },
    ], false),
  ], { horizonScans: 1 });

  assert.equal(report.observedOutcomeCount, 0);
  assert.equal(report.pendingOutcomeCount, 2);
  assert.equal(report.outcomes[0].originMarketOpen, false);
  assert.equal(report.outcomes[0].observations, 0);
  assert.equal(report.outcomes[0].latestReturnPct, null);
  assert.equal(report.marketOpenObservationsOnly, true);
});

test("ignores closed scans between open-session observations", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("open-1", "2026-07-16T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER" },
    ], true),
    record("closed-1", "2026-07-17T00:30:00.000Z", [
      { symbol: "ABC", price: 10, decision: "DO_NOT_ENTER" },
    ], false),
    record("open-2", "2026-07-17T14:00:00.000Z", [
      { symbol: "ABC", price: 11, decision: "ENTER" },
    ], true),
  ], { horizonScans: 2 });

  const origin = report.outcomes.find((row) => row.originScanId === "open-1");
  assert.equal(origin.observations, 1);
  assert.equal(origin.latestPrice, 11);
  assert.equal(origin.latestReturnPct, 10);
});

test("horizon counts market-open scans instead of closed scan records", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("open-1", "2026-07-16T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER" },
    ], true),
    record("closed-1", "2026-07-16T22:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "DO_NOT_ENTER" },
    ], false),
    record("closed-2", "2026-07-17T00:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "DO_NOT_ENTER" },
    ], false),
    record("closed-3", "2026-07-17T12:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "DO_NOT_ENTER" },
    ], false),
    record("open-2", "2026-07-17T14:00:00.000Z", [
      { symbol: "ABC", price: 11, decision: "ENTER" },
    ], true),
  ], { horizonScans: 1 });

  const origin = report.outcomes.find((row) => row.originScanId === "open-1");
  assert.equal(origin.observations, 1);
  assert.equal(origin.latestPrice, 11);
  assert.equal(origin.latestReturnPct, 10);
});


test("keeps stale market-open origins pending", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("open-stale-origin", "2026-07-16T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER", sourceStale: true },
    ], true),
    record("open-fresh-future", "2026-07-16T14:01:00.000Z", [
      { symbol: "ABC", price: 11, decision: "ENTER", sourceStale: false },
    ], true),
  ], { horizonScans: 1 });

  const origin = report.outcomes.find((row) => row.originScanId === "open-stale-origin");
  assert.equal(origin.originMarketOpen, true);
  assert.equal(origin.originSourceStale, true);
  assert.equal(origin.originObservable, false);
  assert.equal(origin.observations, 0);
  assert.equal(origin.latestPrice, null);
  assert.equal(origin.latestReturnPct, null);
  assert.equal(report.freshSourceObservationsOnly, true);
});

test("stale open candidates do not consume the fresh observation horizon", () => {
  const report = buildOpportunityOutcomeTrackingReport([
    record("open-origin", "2026-07-16T14:00:00.000Z", [
      { symbol: "ABC", price: 10, decision: "ENTER", sourceStale: false },
    ], true),
    record("open-stale", "2026-07-16T14:01:00.000Z", [
      { symbol: "ABC", price: 99, decision: "ENTER", sourceStale: true },
    ], true),
    record("open-fresh", "2026-07-16T14:02:00.000Z", [
      { symbol: "ABC", price: 11, decision: "ENTER", sourceStale: false },
    ], true),
  ], { horizonScans: 1 });

  const origin = report.outcomes.find((row) => row.originScanId === "open-origin");
  assert.equal(origin.originObservable, true);
  assert.equal(origin.observations, 1);
  assert.equal(origin.latestPrice, 11);
  assert.equal(origin.latestReturnPct, 10);
});
