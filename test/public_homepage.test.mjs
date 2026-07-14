import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildPublicHomepage,
  renderPublicHomepageHtml,
} from "../src/scanner/public_homepage.mjs";

test("builds public GeminiScanner homepage without internal operations metadata", () => {
  const page = buildPublicHomepage();

  assert.equal(page.route, "/");
  assert.equal(page.product, "GeminiScanner");
  assert.equal(page.signInHref, "/customer");
  assert.equal(page.readOnly, true);
  assert.equal(page.decisionAssistOnly, true);
});

test("renders public homepage with product information and no admin or diagnostic links", () => {
  const html = renderPublicHomepageHtml();

  assert.match(html, /GeminiScanner/);
  assert.match(html, /Scanner capabilities/);
  assert.match(html, /Coming next/);
  assert.match(html, /href="\/customer"/);
  assert.doesNotMatch(html, /\/admin\b|\/diagnostics\b|\/app\b|paper trading|broker|security|deployment|internal owner/i);
});

test("server root route uses isolated public homepage renderer", () => {
  const server = fs.readFileSync("src/server.js", "utf8");

  assert.match(server, /buildPublicHomepage/);
  assert.match(server, /renderPublicHomepageHtml/);
  assert.doesNotMatch(
    server.match(/app\.get\('\/'[\s\S]*?\n}\);/)?.[0] ?? "",
    /\/diagnostics\/|paper broker|SPY buy|internal owner/i
  );
});

test("renders shared global black neon theme and fixed background logo", () => {
  const html = renderPublicHomepageHtml();

  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v1"/);
  assert.match(html, /data-gs-surface="public"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
});

test("public theme preserves public-only navigation and safety wording", () => {
  const html = renderPublicHomepageHtml();

  assert.match(html, /href="\/signup"/);
  assert.match(html, /href="\/customer"/);
  assert.match(html, /href="\/customer\/scanner"/);
  assert.match(html, /Decision assist only\. No automatic execution\./);
  assert.doesNotMatch(html, /\/admin\b|Place order|Buy now|automatic trading/i);
});
