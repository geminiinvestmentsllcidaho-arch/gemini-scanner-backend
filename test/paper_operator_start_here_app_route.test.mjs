import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";
import { buildPaperOperatorStartHereAppScreen, renderPaperOperatorStartHereAppScreenHtml } from "../src/scanner/paper_operator_start_here_app_screen.mjs";

test("paper operator start here app screen is read-only and links workflow routes", () => {
  const screen = buildPaperOperatorStartHereAppScreen();
  const html = renderPaperOperatorStartHereAppScreenHtml(screen);
  assert.equal(screen.route, "/app/paper-operator-start-here");
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.displayState, "PAPER_OPERATOR_START_HERE_READONLY");
  assert.equal(screen.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.match(html, /Paper Trading Readiness Gate/);
  assert.match(html, /Paper App Broker Readiness Index/);
  assert.doesNotMatch(html, /Approval Record|Approval Lock|approval record/i);
  assert.deepEqual([html.includes("No broker contact"), html.includes("No order placement"), html.includes("No account mutation")], [true, true, true]);
  assert.doesNotMatch(html, /<button|<form|method=["']post/i);
});

test("app navigation and server register paper operator start here route", async () => {
  const nav = buildAppNavigationReadonly();
  const entry = nav.entries.find((item) => item.id === "paper_operator_start_here");
  assert.ok(entry);
  assert.equal(entry.routeHref, "/app/paper-operator-start-here");
  const server = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(server, /paper_operator_start_here_app_screen\.mjs/);
  assert.ok(server.includes("app.get('/app/paper-operator-start-here'"));
});
