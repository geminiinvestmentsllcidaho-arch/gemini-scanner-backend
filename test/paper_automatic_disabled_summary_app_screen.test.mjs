import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ROUTE,
  buildPaperAutomaticDisabledSummaryAppScreen,
  renderPaperAutomaticDisabledSummaryAppScreenHtml,
} from "../src/scanner/paper_automatic_disabled_summary_app_screen.mjs";

test("automatic Stage 3 disabled summary remains read-only and non-executing", async () => {
  const screen = await buildPaperAutomaticDisabledSummaryAppScreen({}, 1_000_000);
  const html = renderPaperAutomaticDisabledSummaryAppScreenHtml(screen);
  assert.equal(screen.route, ROUTE);
  assert.equal(screen.displayState, "PAPER_AUTOMATIC_DISABLED_SUMMARY_READONLY");
  assert.equal(screen.finalDecision, "NO_GO_FOR_AUTOMATIC_EXECUTION");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.reviewOnly, true);
  assert.equal(screen.approvalControlsPresent, false);
  assert.equal(screen.unlockControlsPresent, false);
  assert.equal(screen.executionControlsPresent, false);
  assert.equal(screen.executionEnabled, false);
  assert.equal(screen.adapterInvoked, false);
  assert.equal(screen.networkAttempted, false);
  assert.equal(screen.brokerContactAttempted, false);
  assert.equal(screen.brokerMutationAttempted, false);
  assert.equal(screen.orderPlacementAttempted, false);
  assert.equal(screen.cancellationAttempted, false);
  assert.equal(screen.automaticEnterAttempted, false);
  assert.equal(screen.automaticExitAttempted, false);
  assert.match(html, /No adapter invocation/);
  assert.match(html, /NO_GO_FOR_AUTOMATIC_EXECUTION/);
  assert.doesNotMatch(html, /<form|<button|type="submit"/i);
});

test("server and navigation register the automatic Stage 3 disabled summary route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const navigation = fs.readFileSync("src/scanner/app_navigation_readonly.mjs", "utf8");
  assert.match(server, /app\.get\('\/app\/paper-automatic-disabled-summary'/);
  assert.match(server, /paper_automatic_disabled_summary_app_screen\.mjs/);
  assert.match(navigation, /id: "paper_automatic_disabled_summary"/);
  assert.match(navigation, /routeHref: "\/app\/paper-automatic-disabled-summary"/);
});
