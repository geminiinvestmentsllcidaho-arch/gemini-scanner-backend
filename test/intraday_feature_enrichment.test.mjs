import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveIntradayFeaturesFromSnapshot,
  enrichScannerRankingWithIntradayFeatures
} from "../src/scanner/intraday_feature_enrichment.mjs";

test("derives empty intraday setup features safely without execution fields", () => {
  const out = deriveIntradayFeaturesFromSnapshot({});
  assert.equal(out.lastPrice, null);
  assert.equal(out.intradayFeatureSource, "live_snapshot_bars");
  assert.equal(out.intradayBarsCount, 0);
});

test("derives intraday setup features from live snapshot bars", () => {
  const prior = [
    { t: "2026-06-30T13:30:00Z", o: 10, h: 10.2, l: 9.9, c: 10.1, v: 500, vw: 10.05 },
    { t: "2026-06-30T13:31:00Z", o: 10.1, h: 10.4, l: 10, c: 10.3, v: 500, vw: 10.22 }
  ];
  const today = [
    { t: "2026-07-01T13:30:00Z", o: 11, h: 11.2, l: 10.9, c: 11.1, v: 1000, vw: 11.05 },
    { t: "2026-07-01T13:31:00Z", o: 11.1, h: 11.6, l: 10.8, c: 11.5, v: 1500, vw: 11.4 },
    { t: "2026-07-01T13:32:00Z", o: 11.5, h: 11.8, l: 11.4, c: 11.7, v: 2000, vw: 11.6 }
  ];

  const out = deriveIntradayFeaturesFromSnapshot({
    price: 11.7,
    quote: { bp: 11.69, ap: 11.71 },
    bars: [...prior, ...today],
  });

  assert.equal(out.lastPrice, 11.7);
  assert.equal(out.previousClose, 10.3);
  assert.equal(out.previousPrice, 10.3);
  assert.equal(out.dayOpen, 11);
  assert.ok(out.vwap > 11);
  assert.equal(out.openingRangeHigh, 11.8);
  assert.equal(out.volume, 4500);
  assert.ok(out.relativeVolume > 1);
  assert.ok(out.spreadPct > 0);
  assert.ok(out.changePct > 0);
  assert.ok(out.gapPct > 0);
  assert.ok(out.pullbackPct >= 0);
  assert.equal(out.intradayFeatureSource, "live_snapshot_bars");
  assert.equal(out.intradayBarsCount, 5);
  assert.equal(out.intradaySessionBarsCount, 3);
});

test("enriches scanner ranking while preserving read-only candidate data", () => {
  const out = enrichScannerRankingWithIntradayFeatures(
    { symbol: "TEST", confidence: 0.8, p3GateOk: true },
    {
      price: 12.2,
      bars: [
        { t: "2026-06-30T13:30:00Z", o: 10, h: 10.2, l: 9.9, c: 10, v: 1000, vw: 10 },
        { t: "2026-07-01T13:30:00Z", o: 12, h: 12.4, l: 11.8, c: 12.2, v: 3000, vw: 12.1 }
      ]
    }
  );

  assert.equal(out.symbol, "TEST");
  assert.equal(out.confidence, 0.8);
  assert.equal(out.p3GateOk, true);
  assert.equal(out.lastPrice, 12.2);
  assert.equal(out.previousClose, 10);
  assert.equal(out.dayOpen, 12);
  assert.equal(out.volume, 3000);
});
