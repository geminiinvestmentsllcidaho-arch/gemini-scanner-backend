import assert from "node:assert/strict";
import test from "node:test";
import {
  injectCustomerLifetimeEarningsBanner,
  renderCustomerLifetimeEarningsBanner,
} from "../src/scanner/customer_lifetime_earnings_banner.mjs";

const closedClock = {
  isOpen: false,
  nextOpen: "2026-08-06T09:30:00-04:00",
  nextClose: "2026-08-05T16:00:00-04:00",
};

test("renders compact lifetime profit and market-open countdown by default", () => {
  const html = renderCustomerLifetimeEarningsBanner({
    netAfterCosts: 125.5,
    realizedPl: 100,
    unrealizedPl: 25.5,
    totalReturnPct: 1.25,
  }, { marketClock: closedClock });
  assert.match(html, /Lifetime Profit/);
  assert.match(html, /\$125\.50/);
  assert.match(html, /Market opens in/);
  assert.match(html, /data-mode="open"/);
  assert.doesNotMatch(html, /data-gs-lifetime-profit-details/);
  assert.doesNotMatch(html, />Realized</);
});

test("renders detailed metrics only when explicitly requested", () => {
  const html = renderCustomerLifetimeEarningsBanner({
    netAfterCosts: 125.5,
    realizedPl: 100,
    unrealizedPl: 25.5,
    totalReturnPct: 1.25,
  }, {
    detailed: true,
    marketClock: { ...closedClock, isOpen: true, nextClose: "2026-08-06T16:00:00-04:00" },
  });
  assert.match(html, /data-gs-lifetime-profit-details="true"/);
  assert.match(html, />Realized</);
  assert.match(html, />Unrealized</);
  assert.match(html, />Return</);
  assert.match(html, /Market closes in/);
  assert.match(html, /data-mode="close"/);
});

test("fails closed without synthesizing profit", () => {
  const html = renderCustomerLifetimeEarningsBanner(null);
  assert.match(html, /Lifetime Profit/);
  assert.match(html, /No data yet/);
  assert.doesNotMatch(html, /\$0\.00/);
});

test("injects once after the GeminiScanner header", () => {
  const banner = renderCustomerLifetimeEarningsBanner({ totalPl: 4 });
  const page = '<!doctype html><html><body><header class="gs-global-header">Logo</header><main>Page</main></body></html>';
  const once = injectCustomerLifetimeEarningsBanner(page, banner);
  assert.ok(once.indexOf('class="gs-global-header"') < once.indexOf('class="gs-lifetime-profit-banner"'));
  assert.ok(once.indexOf('class="gs-lifetime-profit-banner"') < once.indexOf("<main>"));
  assert.equal(injectCustomerLifetimeEarningsBanner(once, banner), once);
});

test("does not alter non-HTML fragments without a body", () => {
  assert.equal(injectCustomerLifetimeEarningsBanner('{"ok":true}', "<section>banner</section>"), '{"ok":true}');
});
