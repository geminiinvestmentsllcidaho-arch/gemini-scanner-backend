import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAlpacaUnderFiveUniverseAppCard,
  renderAlpacaUnderFiveUniverseAppCardHtml,
} from "../src/scanner/alpaca_under_five_universe_app_card.mjs";

test("builds mobile-ready under-five read-only app card", () => {
  const card = buildAlpacaUnderFiveUniverseAppCard({
    ok: true,
    version: "alpaca_under_five_universe_readonly_v1",
    status: "connected_readonly",
    assetCount: 1000,
    snapshotCount: 998,
    candidateCount: 1,
    candidates: [{
      symbol: "TEST",
      price: 3.5,
      dailyVolume: 800000,
      dollarVolume: 2800000,
      previousClose: 3.2,
      changePct: 9.375,
      spreadPct: 0.2857,
      sourceTs: "2026-07-10T18:30:00.000Z",
      sourceAgeSec: 4.2,
      sourceStale: false,
      readonlyPotentialScore: 91.25,
      readonlyPotentialLabel: "strong_watch",
      readonlyPotentialFlags: [],
    }],
  }, {
    now: new Date("2026-07-10T18:30:05.000Z"),
    refreshIntervalSec: 20,
  });

  assert.equal(card.ok, true);
  assert.equal(card.displayState, "UNDER_FIVE_READONLY_APP_CARD_CONNECTED");
  assert.equal(card.panelType, "mobile_app_card");
  assert.equal(card.candidates[0].symbol, "TEST");
  assert.equal(card.candidates[0].decisionAssistOnly, true);
  assert.equal(card.candidates[0].buyRecommendation, false);
  assert.equal(card.readOnly, true);
  assert.equal(card.noExecutionControls, true);
  assert.equal(card.orderSubmitted, false);
  assert.equal(card.brokerContactAttempted, false);
  assert.equal(card.accountMutationAttempted, false);
});

test("renders under-five read-only app card without execution controls", () => {
  const card = buildAlpacaUnderFiveUniverseAppCard({
    ok: true,
    status: "connected_readonly",
    candidateCount: 1,
    candidates: [{
      symbol: "SAFE",
      price: 2.25,
      readonlyPotentialScore: 39,
      readonlyPotentialLabel: "low_priority",
      readonlyPotentialFlags: ["wide_spread"],
      sourceStale: false,
    }],
  });

  const html = renderAlpacaUnderFiveUniverseAppCardHtml(card);

  assert.match(html, /Under \$5 Read-Only Potential/);
  assert.match(html, /SAFE/);
  assert.match(html, /wide_spread/);
  assert.match(html, /No execution controls:<\/b> true/);
  assert.match(html, /Buy recommendation:<\/b> false/);
  assert.match(html, /data-readonly-auto-refresh="true"/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /\bPOST\b\|\bDELETE\b/);
});

test("builds fail-closed not-connected card", () => {
  const card = buildAlpacaUnderFiveUniverseAppCard({
    ok: true,
    status: "not_connected_readonly",
    candidates: [],
  });

  assert.equal(card.displayState, "UNDER_FIVE_READONLY_APP_CARD_NOT_CONNECTED");
  assert.equal(card.candidateCount, 0);
  assert.equal(card.orderPlacementAllowed, false);
  assert.equal(card.accountMutationAllowed, false);
});

test("renders decision badge brief explanation and detail link", () => {
  const card = buildAlpacaUnderFiveUniverseAppCard({
    ok: true,
    status: "connected_readonly",
    candidates: [{
      symbol: "INFO",
      price: 4.2,
      decision: "ENTER",
      briefExplanation: "Strong score with positive momentum and acceptable spread.",
      blockingFlags: [],
      readonlyPotentialScore: 92,
    }],
  }, { autoRefreshEnabled: false });

  const html = renderAlpacaUnderFiveUniverseAppCardHtml(card);

  assert.match(html, />ENTER<\/summary>/);
  assert.match(html, /title="Strong score with positive momentum and acceptable spread\."/);
  assert.match(html, /Tap for more information/);
  assert.match(html, /\/customer-zero\/under-five-scanner\/INFO/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
});
