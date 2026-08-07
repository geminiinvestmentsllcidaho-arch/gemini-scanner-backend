import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("premarket multi-scan results remain readable on narrow mobile screens", () => {
  const source = fs.readFileSync("src/scanner/customer_scanner_hub.mjs", "utf8");
  assert.match(source, /\.premarket-multiscan-table\{[^}]*min-width:820px/);
  assert.match(source, /\.premarket-multiscan-table th,\.premarket-multiscan-table td\{[^}]*white-space:nowrap[^}]*word-break:normal[^}]*overflow-wrap:normal/);
  assert.match(source, /nth-child\(2\)[^{]*\{[^}]*min-width:150px[^}]*white-space:normal/);
  assert.match(source, /nth-child\(8\)[^{]*\{[^}]*min-width:240px[^}]*white-space:normal/);
  assert.match(source, /\.premarket-multiscan-table-wrap\{overflow-x:auto\}/);
});

test("settings does not render redundant Security activity and About AI secondary links", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  const start = source.indexOf("app.get('/customer/settings', requireCustomerSession");
  const end = source.indexOf("app.post('/customer/settings/profile'", start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /class="settings-secondary-nav"/);
  assert.doesNotMatch(block, /href="#about-ai">About AI<\/a>/);
  assert.doesNotMatch(block, /<nav[^>]*Settings navigation/);
  assert.match(block, /<h2>Security activity<\/h2>/);
  assert.match(block, /View complete security activity/);
  assert.match(block, /About GeminiScanner AI/);
});
