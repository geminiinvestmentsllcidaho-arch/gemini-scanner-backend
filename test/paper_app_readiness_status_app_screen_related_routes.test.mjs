import test from "node:test";
import assert from "node:assert/strict";

import { renderPaperAppReadinessStatusAppScreenHtml } from "../src/scanner/paper_app_readiness_status_app_screen.mjs";

test("paper app readiness status links related broker readiness routes and remains locked", () => {
  const html = renderPaperAppReadinessStatusAppScreenHtml({});

  assert.match(html, /Paper App Readiness Status/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /\/app\/paper-app-broker-readiness-index/);
  assert.match(html, /\/app\/paper-broker-runtime-environment-preflight/);
  assert.match(html, /\/app\/paper-readiness-gate/);

  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
  assert.match(html, /No route execution, no broker contact, no order submit/);
});
