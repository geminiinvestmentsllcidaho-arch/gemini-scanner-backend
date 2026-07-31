import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ROUTE,
  buildPaperAutomaticDisabledAppScreen,
  renderPaperAutomaticDisabledAppScreenHtml,
} from "../src/scanner/paper_automatic_disabled_app_screen.mjs";

test("automatic Stage 3 app screen exposes no execution controls", () => {
  const screen = buildPaperAutomaticDisabledAppScreen({}, 1_000_000);
  assert.equal(screen.route, ROUTE);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.executionControlsPresent, false);
  assert.equal(screen.executionEnabled, false);
  assert.equal(screen.automaticEnterEnabled, false);
  assert.equal(screen.automaticExitEnabled, false);
  const html = renderPaperAutomaticDisabledAppScreenHtml(screen);
  assert.match(html, /No automatic entry/);
  assert.match(html, /No automatic exit/);
  assert.match(html, /No execution controls/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
});

test("server and navigation register the automatic disabled preview route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const nav = fs.readFileSync("src/scanner/app_navigation_readonly.mjs", "utf8");
  assert.match(server, /app\.get\('\/app\/paper-automatic-disabled-preview'/);
  assert.match(server, /paper_automatic_disabled_app_screen\.mjs/);
  assert.match(nav, /paper_automatic_disabled_preview/);
  assert.match(nav, /\/app\/paper-automatic-disabled-preview/);
});
