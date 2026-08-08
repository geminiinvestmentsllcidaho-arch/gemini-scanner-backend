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

test("public homepage prominently explains AI-backed decision support", () => {
  const page = buildPublicHomepage();
  const html = renderPublicHomepageHtml(page);

  assert.match(page.eyebrow, /AI-backed/i);
  assert.match(page.headline, /AI-backed stock decisions/i);
  assert.match(page.description, /AI-assisted analysis/i);
  assert.match(html, /AI-assisted opportunity review/);
  assert.match(html, /patterns, risks, missing information/);
  assert.match(html, /without changing scanner logic or placing trades/);
  assert.match(html, /AI-assisted analysis/);
  assert.match(html, /Pre-market scanner/);
  assert.match(html, /Post-market scanner/);
  assert.match(html, /Automatic/);
  assert.match(html, /Post-market scanner/);
  assert.match(html, /Automatic/);
  assert.match(html, /\.hero,\.section\{border:0/);
  assert.match(html, /\.card\{background:#0d1521;border:0/);
  assert.match(html, /every final decision in your hands/);
});

test("renders public homepage with product information and no admin or diagnostic links", () => {
  const html = renderPublicHomepageHtml();

  assert.match(html, /GeminiScanner/);
  assert.match(html, /AI-backed analysis with human control/);
  assert.match(html, /Coming next/);
  assert.match(html, /href="\/customer"/);
  assert.match(html, /href="\/admin\/login"[^>]*>Admin sign in<\/a>/i)
  const publicHtmlWithoutAdminLogin = html.replace(/<a\b[^>]*href="\/admin\/login"[^>]*>[\s\S]*?<\/a>/i, "")
  assert.doesNotMatch(publicHtmlWithoutAdminLogin, /\/admin\b|\/diagnostics\b|\/app\b|paper trading|broker|security|deployment|internal owner/i);
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

  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v4"/);
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
  assert.match(html, /href="\/admin\/login"[^>]*>Admin sign in<\/a>/i)
  const themedPublicHtmlWithoutAdminLogin = html.replace(/<a\b[^>]*href="\/admin\/login"[^>]*>[\s\S]*?<\/a>/i, "")
  assert.doesNotMatch(themedPublicHtmlWithoutAdminLogin, /\/admin\b|Place order|Buy now|automatic trading/i);
});
