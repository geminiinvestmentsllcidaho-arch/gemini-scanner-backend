import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("wires authenticated GET-only Stage 1 evidence downloads", () => {
  assert.match(source, /app\.get\('\/customer\/stage1\/evidence\.json', requireCustomerSession, async/);
  assert.match(source, /app\.get\('\/customer\/stage1\/evidence\.txt', requireCustomerSession, async/);
  assert.match(source, /Cache-Control', 'no-store'/);
  assert.match(source, /Content-Disposition/);
  assert.match(source, /record\.exportReady !== true/);
  assert.match(source, /status\(409\)/);
  assert.match(source, /status\(503\)/);
  assert.doesNotMatch(source, /app\.post\('\/customer\/stage1\/evidence\./);
});

test("portfolio route keeps archived Stage 1 evidence panels off the Portfolio page", () => {
  const start = source.indexOf("app.get('/customer/portfolio'");
  const end = source.indexOf("app.post('/customer/portfolio/owned-assets'", start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /buildCustomerStage1EvidenceExport|buildCustomerStage1EvidenceDownloadPanel/);
  assert.doesNotMatch(block, /stage1PostTradeReviewHtml:|stage1EvidenceDownloadHtml:/);
});
