import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ROUTE,
  buildPaperAutomaticDisabledChainAppScreen,
  renderPaperAutomaticDisabledChainAppScreenHtml,
} from "../src/scanner/paper_automatic_disabled_chain_app_screen.mjs";

test("automatic Stage 3 mechanical-chain app screen remains read-only and non-executing", async () => {
  const screen = await buildPaperAutomaticDisabledChainAppScreen({});
  const html = renderPaperAutomaticDisabledChainAppScreenHtml(screen);

  assert.equal(screen.route, ROUTE);
  assert.equal(screen.displayState, "BLOCKED");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.reviewOnly, true);
  assert.equal(screen.executionControlsPresent, false);
  assert.equal(screen.executionEnabled, false);
  assert.equal(screen.adapterInvoked, false);
  assert.equal(screen.networkAttempted, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.cancellationAllowed, false);
  assert.equal(screen.automaticEnterEnabled, false);
  assert.equal(screen.automaticExitEnabled, false);
  assert.match(html, /No automatic adapter invocation/);
  assert.doesNotMatch(html, /<form|<button|type="submit"/i);
});

test("server and navigation register the automatic Stage 3 mechanical-chain route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const navigation = fs.readFileSync(
    "src/scanner/app_navigation_readonly.mjs",
    "utf8",
  );

  assert.match(server, /app\.get\('\/app\/paper-automatic-disabled-chain'/);
  assert.match(
    server,
    /paper_automatic_disabled_chain_app_screen\.mjs/,
  );
  assert.match(
    navigation,
    /id: "paper_automatic_disabled_chain"/,
  );
  assert.match(
    navigation,
    /routeHref: "\/app\/paper-automatic-disabled-chain"/,
  );
});
