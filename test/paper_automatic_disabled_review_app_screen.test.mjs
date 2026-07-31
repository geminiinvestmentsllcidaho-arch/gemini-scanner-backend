import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ROUTE,
  buildPaperAutomaticDisabledReviewAppScreen,
  renderPaperAutomaticDisabledReviewAppScreenHtml,
} from "../src/scanner/paper_automatic_disabled_review_app_screen.mjs";

test("automatic Stage 3 contract review is read-only and cannot unlock or execute", () => {
  const screen = buildPaperAutomaticDisabledReviewAppScreen({}, 1_000_000);
  assert.equal(screen.route, ROUTE);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.reviewOnly, true);
  assert.equal(screen.approvalControlsPresent, false);
  assert.equal(screen.unlockControlsPresent, false);
  assert.equal(screen.executionControlsPresent, false);
  assert.equal(screen.executionEnabled, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.automaticEnterEnabled, false);
  assert.equal(screen.automaticExitEnabled, false);
  assert.equal(screen.stage2ProofRequired, true);
  assert.equal(screen.stage3ExplicitUnlockRequired, true);
  const html = renderPaperAutomaticDisabledReviewAppScreenHtml(screen);
  assert.match(html, /No approval button/);
  assert.match(html, /No stage-unlock control/);
  assert.match(html, /No automatic entry/);
  assert.match(html, /No automatic exit/);
  assert.match(html, /No execution controls/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
});

test("server and navigation register automatic Stage 3 contract review route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const nav = fs.readFileSync("src/scanner/app_navigation_readonly.mjs", "utf8");
  assert.match(server, /app\.get\('\/app\/paper-automatic-disabled-review'/);
  assert.match(server, /paper_automatic_disabled_review_app_screen\.mjs/);
  assert.match(nav, /paper_automatic_disabled_review/);
  assert.match(nav, /\/app\/paper-automatic-disabled-review/);
});
