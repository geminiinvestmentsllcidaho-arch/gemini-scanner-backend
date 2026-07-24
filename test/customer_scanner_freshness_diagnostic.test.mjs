import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerScannerFreshnessDiagnostic, VERSION } from "../src/scanner/customer_scanner_freshness_diagnostic.mjs";

test("freshness diagnostic separates ranking staleness from quote freshness", () => {
  const out = buildCustomerScannerFreshnessDiagnostic({
    nowMs: Date.parse("2026-07-24T14:00:00.000Z"),
    cacheDiagnostics: { running: true, scanCount: 12, hasSnapshot: true, latest: { marketClock: { isOpen: true }, candidateCount: 1, candidates: [{ symbol: "ABC", sourceTs: "2026-07-24T13:59:50.000Z", sourceAgeSec: 10, maxSourceAgeSec: 120, sourceStale: false, decision: "WAIT" }], sharedCache: { generatedAt: "2026-07-24T13:59:55.000Z", clockCheckedAt: "2026-07-24T13:59:55.000Z" } } },
    rankingRoot: { source: "/missing/dryrun.jsonl", sourceTs: "2026-07-10T16:23:11.550Z", sourceAgeSec: 1235328, maxAgeSec: 180, stale: true, scannerHealth: "stale", count: 1, issues: ["SCANNER_TELEMETRY_STALE"], rankings: [{ symbol: "ABC", rank: 1 }] },
    streamTelemetry: { streamConnected: true, streamStale: false, lastEventAgeSec: 0, staleThresholdSec: 90, reconnectAttempts: 0 },
  });
  assert.equal(out.version, VERSION);
  assert.equal(out.quoteFreshness.staleCount, 0);
  assert.equal(out.rankingFreshness.stale, true);
  assert.deepEqual(out.candidates[0].staleReasons, ["RANKINGS_STALE"]);
  assert.equal(out.candidates[0].finalResultState, "STALE_DATA");
  assert.equal(out.stream.connected, true);
  assert.equal(out.safety.orderPlacementAllowed, false);
});

test("freshness diagnostic reports missing ranking independently", () => {
  const out = buildCustomerScannerFreshnessDiagnostic({ cacheDiagnostics: { latest: { candidates: [{ symbol: "MISS", sourceStale: false }] } }, rankingRoot: { stale: false, rankings: [{ symbol: "OTHER" }] } });
  assert.deepEqual(out.candidates[0].staleReasons, ["RANKING_MISSING"]);
  assert.equal(out.staleReasonCounts.RANKING_MISSING, 1);
});
