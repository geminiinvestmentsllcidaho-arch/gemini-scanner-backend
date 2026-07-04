import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml,
} from "../src/scanner/app_navigation_readonly.mjs";

test("app navigation routeHref links are labeled as app routes", () => {
  const nav = buildAppNavigationReadonly();
  const html = renderAppNavigationReadonlyHtml(nav);

  assert.equal(nav.entries.length, 40);
  assert.equal(nav.entries.every((entry) => String(entry.routeHref || "").startsWith("/app/")), true);
  assert.match(html, />App Route<\/a>/);
  assert.doesNotMatch(html, />Diagnostics<\/a>/);
  assert.match(html, />JSON<\/a>/);
});
