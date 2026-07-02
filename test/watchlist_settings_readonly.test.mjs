import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWatchlistSettingsReadonly,
  normalizeWatchlistSymbols,
  renderWatchlistSettingsReadonlyHtml
} from "../src/scanner/watchlist_settings_readonly.mjs";

test("normalizes and builds read-only watchlist settings", () => {
  assert.deepEqual(normalizeWatchlistSymbols("aapl,msft,AAPL,bad symbol,nvda"), ["AAPL", "MSFT", "NVDA"]);
  const panel = buildWatchlistSettingsReadonly({ symbols: "aapl,msft,nvda", session: "closed", refreshIntervalSec: 45, now: new Date("2026-07-02T18:45:00Z") });
  assert.equal(panel.ok, true);
  assert.equal(panel.displayState, "WATCHLIST_SETTINGS_READY_READONLY");
  assert.deepEqual(panel.symbols, ["AAPL", "MSFT", "NVDA"]);
  assert.equal(panel.selectedSession, "closed");
  assert.equal(panel.refreshIntervalSec, 45);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.orderSubmitted, false);
  assert.equal(panel.brokerContactAttempted, false);
  assert.equal(panel.accountMutationAttempted, false);
});

test("renders read-only watchlist settings html safely", () => {
  const panel = buildWatchlistSettingsReadonly({ symbols: ["AAPL", "MSFT"], session: "regular", refreshIntervalSec: 30 });
  const html = renderWatchlistSettingsReadonlyHtml(panel);
  assert.match(html, /Watchlist &amp; Settings/);
  assert.match(html, /AAPL/);
  assert.match(html, /MSFT/);
  assert.match(html, /data-readonly-auto-refresh="true"/);
  assert.match(html, /window\.location\.reload\(\)/);
  assert.match(html, /No execution controls:<\/b> true/);
  assert.match(html, /Order submitted:<\/b> false/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /\bPOST\b|\bDELETE\b/);
});
