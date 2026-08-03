import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildCustomerPortfolioPage,
  renderCustomerPortfolioPageHtml,
} from "../src/scanner/customer_portfolio_page.mjs";

test("portfolio renders incident between timeline and Monday checklist", () => {
  const html = renderCustomerPortfolioPageHtml(buildCustomerPortfolioPage({
    stage1EventTimelineHtml: '<section data-stage1-event-timeline></section>',
    stage1LiveIncidentHtml: '<section data-stage1-live-incident></section>',
    stage1MondayChecklistHtml: '<section data-stage1-monday-checklist></section>',
  }));
  const timeline = html.indexOf("data-stage1-event-timeline");
  const incident = html.indexOf("data-stage1-live-incident");
  const checklist = html.indexOf("data-stage1-monday-checklist");
  assert.ok(timeline >= 0);
  assert.ok(incident > timeline);
  assert.ok(checklist > incident);
});

test("server composes the read-only Stage 1 live incident panel", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  assert.match(source, /customer_stage1_live_incident_panel\.mjs/);
  assert.match(source, /buildCustomerStage1LiveIncidentPanel/);
  assert.match(source, /renderCustomerStage1LiveIncidentPanelHtml/);
});
