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
