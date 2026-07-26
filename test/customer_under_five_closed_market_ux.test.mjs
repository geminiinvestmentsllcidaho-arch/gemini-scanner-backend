import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAlpacaUnderFiveUniverseAppCard,
  renderAlpacaUnderFiveUniverseAppCardHtml,
} from "../src/scanner/alpaca_under_five_universe_app_card.mjs";
import {
  buildCustomerUnderFiveDashboard,
  renderCustomerUnderFiveDashboardHtml,
} from "../src/scanner/customer_under_five_dashboard.mjs";

const source = {
  ok: true,
  status: "connected_readonly",
  marketClock: {
    isOpen: false,
    nextOpen: "2026-07-27T09:30:00-04:00",
  },
  candidates: [],
};

test("closed-market app card explains pause and disables page reload", () => {
  const card = buildAlpacaUnderFiveUniverseAppCard(source, {
    autoRefreshEnabled: true,
  });
  const html = renderAlpacaUnderFiveUniverseAppCardHtml(card);

  assert.equal(card.marketClosed, true);
  assert.match(card.nextOpenLabel, /Monday, July 27/);
  assert.match(html, /Live scanner results are paused until the next market open/);
  assert.match(html, /Next market open:/);
  assert.match(html, /Scanner status:<\/b> Paused while the market is closed/);
  assert.doesNotMatch(html, /Next refresh in:/);
  assert.doesNotMatch(html, /data-readonly-auto-refresh="true"/);
  assert.doesNotMatch(html, /window\.location\.reload/);
});

test("customer scanner emits a valid HTML doctype", () => {
  const html = renderCustomerUnderFiveDashboardHtml({
    title: "Under $5 Scanner",
    headline: "Read-only",
    candidateCount: 0,
    candidates: [],
    marketClock: {
      isOpen: false,
      nextOpen: "2026-07-27T13:30:00.000Z",
    },
  });

  assert.match(html, /^<!doctype html>/i);
  assert.doesNotMatch(html, /^<doctype html>/i);
});

test("closed customer scanner does not advertise a polling interval while paused", () => {
  const html = renderCustomerUnderFiveDashboardHtml({
    title: "Under $5 Scanner",
    headline: "Read-only",
    candidateCount: 0,
    candidates: [],
    refreshSec: 30,
    marketClock: {
      isOpen: false,
      nextOpen: "2026-07-27T13:30:00.000Z",
    },
  });

  assert.match(html, /<b>Refresh:<\/b> Paused until market open/);
  assert.doesNotMatch(html, /<b>Refresh:<\/b> 30s/);
  assert.match(html, /<b>Market:<\/b> Closed/);
});

test("closed customer scanner shows paused status and closed-market empty state", () => {
  const dashboard = buildCustomerUnderFiveDashboard(source, {
    maxPrice: 5,
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.match(html, /MARKET CLOSED/);
  assert.match(html, /SCANNER PAUSED/);
  assert.match(html, /Next open: Monday, July 27/);
  assert.match(html, /Live scanner results are paused until the next market open/);
  assert.doesNotMatch(html, /NEXT SCAN IN/);
  assert.doesNotMatch(html, /customer-scanner-countdown\.js/);
  assert.match(html, /No order placement, broker contact, or account mutation controls/);
});

test("closed market suppresses cached candidate cards and shows only paused-state results", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ok: true,
    status: "connected_readonly",
    marketClock: {
      isOpen: false,
      nextOpen: "2026-07-27T13:30:00.000Z",
    },
    candidates: [{
      symbol: "STALE",
      price: 4.25,
      decision: "WAIT",
      sourceStale: true,
      sourceAgeSec: 9999,
      readonlyPotentialScore: 80,
    }],
  }, {
    route: "/customer-zero/under-five-scanner",
    maxPrice: 5,
  });

  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.candidateCount, 1);
  assert.match(html, /Market closed\./);
  assert.match(html, /Live scanner results are paused until the next market open\./);
  assert.doesNotMatch(html, /class="decision-card/);
  assert.doesNotMatch(html, />STALE</);
});
