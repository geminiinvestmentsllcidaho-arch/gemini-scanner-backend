import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("registers read-only under-five app and diagnostic routes", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  assert.match(server, /app\.get\('\/diagnostics\/alpaca-under-five-universe-app-card'/);
  assert.match(server, /app\.get\('\/app\/alpaca-under-five-universe'/);
  assert.match(server, /buildAlpacaUnderFiveUniverseAppCard/);
  assert.match(server, /renderAlpacaUnderFiveUniverseAppCardHtml/);
});

test("adds under-five read-only app to navigation", () => {
  const nav = fs.readFileSync("src/scanner/app_navigation_readonly.mjs", "utf8");
  assert.match(nav, /id: "alpaca_under_five_universe"/);
  assert.match(nav, /href: "\/app\/alpaca-under-five-universe"/);
  assert.match(nav, /diagnosticHref: "\/diagnostics\/alpaca-under-five-universe-app-card"/);
  assert.match(nav, /displayState: "UNDER_FIVE_READONLY_APP_CARD_CONNECTED"/);
});
