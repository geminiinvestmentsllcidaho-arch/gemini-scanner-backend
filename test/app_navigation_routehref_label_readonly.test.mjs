import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("app navigation routeHref links are labeled as app routes", () => {
  const nav = buildAppNavigationReadonly();
  const html = renderAppNavigationReadonlyHtml(nav);

  assert.equal(nav.entries.length > 0, true);
  assert.equal(
    nav.entries.every((entry) => {
      const route = String(entry.routeHref || "");
      return route.startsWith("/app/") || route.startsWith("/customer-zero/");
    }),
    true,
  );
  assert.match(html, />App Route<\/a>/);
  assert.doesNotMatch(html, />Diagnostics<\/a>/);
  assert.match(html, />JSON<\/a>/);
});
