import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOMER_PRIMARY_NAVIGATION_ITEMS,
  renderCustomerPrimaryNavigation,
  renderCustomerPrimaryNavigationCss,
} from "../src/scanner/customer_primary_navigation.mjs";

test("defines the exact customer primary navigation routes and order", () => {
  assert.deepEqual(
    CUSTOMER_PRIMARY_NAVIGATION_ITEMS.map(({ id, label, href }) => ({ id, label, href })),
    [
      { id: "overview", label: "Overview", href: "/customer" },
      { id: "scanner", label: "Scanner", href: "/customer/scanner" },
      { id: "watchlist", label: "Watchlist", href: "/customer/watchlist" },
      { id: "portfolio", label: "Portfolio", href: "/customer/portfolio" },
      { id: "reports", label: "Reports", href: "/customer/reports" },
      { id: "settings", label: "Settings", href: "/customer/settings" },
    ],
  );
});

test("renders one active customer route without admin diagnostic or under-five links", () => {
  const html = renderCustomerPrimaryNavigation({ active: "watchlist" });

  assert.match(html, /aria-label="Customer navigation"/);
  assert.match(html, /href="\/customer">[\s\S]*?<span>Overview<\/span><\/a>/);
  assert.match(html, /href="\/customer\/watchlist" aria-current="page">[\s\S]*?<span>Watchlist<\/span><\/a>/);
  assert.doesNotMatch(html, /\/admin\b|\/diagnostics\b|\/app\b|\/customer\/scanner\/under-five/);
});

test("renders responsive shared customer navigation CSS", () => {
  const css = renderCustomerPrimaryNavigationCss();
  assert.match(css, /customer-primary-nav/);
  assert.match(css, /@media\(max-width:640px\)/);
});


test("renders shared SVG navigation icons",()=>{const html=renderCustomerPrimaryNavigation({active:"overview"});assert.match(html,/gs-icon-overview/);assert.match(html,/aria-hidden="true"/);assert.match(html,/<span>Overview<\/span>/);});
