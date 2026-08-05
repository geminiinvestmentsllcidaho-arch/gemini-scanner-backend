import assert from "node:assert/strict";
import test from "node:test";

import {
  injectCustomerLifetimeEarningsBanner,
  renderCustomerLifetimeEarningsBanner,
} from "../src/scanner/customer_lifetime_earnings_banner.mjs";

test("renders authenticated lifetime earnings from ledger-derived performance", () => {
  const html = renderCustomerLifetimeEarningsBanner({
    netAfterCosts: 125.5,
    realizedPl: 100,
    unrealizedPl: 25.5,
    totalReturnPct: 1.25,
  });
  assert.match(html, /Lifetime Earnings/);
  assert.match(html, /\$125\.50/);
  assert.match(html, /\$100\.00/);
  assert.match(html, /\$25\.50/);
  assert.match(html, /1\.25%/);
  assert.match(html, /data-gs-authenticated-only="true"/);
});

test("fails closed without synthesizing earnings", () => {
  const html = renderCustomerLifetimeEarningsBanner(null);
  assert.match(html, /Lifetime Earnings/);
  assert.match(html, /No data yet/);
  assert.doesNotMatch(html, /\$0\.00/);
});

test("injects immediately after body and never duplicates", () => {
  const banner = renderCustomerLifetimeEarningsBanner({ totalPl: 4 });
  const once = injectCustomerLifetimeEarningsBanner("<!doctype html><html><body><main>Page</main></body></html>", banner);
  assert.match(once, /<body><style data-gs-customer-lifetime-earnings=/);
  const twice = injectCustomerLifetimeEarningsBanner(once, banner);
  assert.equal(twice, once);
});

test("does not alter non-HTML fragments without a body", () => {
  assert.equal(injectCustomerLifetimeEarningsBanner('{"ok":true}', "<section>banner</section>"), '{"ok":true}');
});
