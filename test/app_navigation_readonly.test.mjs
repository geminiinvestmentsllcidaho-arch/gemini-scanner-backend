import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml
} from "../src/scanner/app_navigation_readonly.mjs";

test("builds read-only app navigation with todays intraday setup entry", () => {
  const nav = buildAppNavigationReadonly({ now: new Date("2026-07-02T13:00:00Z") });
  assert.equal(nav.displayState, "GEMINISCANNER_APP_NAVIGATION_READY_READONLY");
  assert.equal(nav.panelType, "main_app_navigation");
  assert.equal(nav.entryCount, 1);
  assert.equal(nav.readOnly, true);
  assert.equal(nav.noExecutionControls, true);
  assert.equal(nav.orderSubmitAttempted, false);
  assert.equal(nav.orderSubmitted, false);
  assert.equal(nav.brokerContactAttempted, false);
  assert.equal(nav.accountMutationAttempted, false);

  const entry = nav.entries[0];
  assert.equal(entry.id, "todays_intraday_setups");
  assert.equal(entry.href, "/app/todays-intraday-setups?session=regular");
  assert.equal(entry.diagnosticHref, "/diagnostics/todays-intraday-setups-app-card?session=regular");
  assert.equal(entry.readOnly, true);
  assert.equal(entry.orderPlacementAllowed, false);
  assert.equal(entry.brokerContactAllowed, false);
  assert.equal(entry.accountMutationAllowed, false);
});

test("renders app navigation html", () => {
  const nav = buildAppNavigationReadonly();
  const html = renderAppNavigationReadonlyHtml(nav);
  assert.match(html, /GeminiScanner App/);
  assert.match(html, /Today(?:&#39;|')s Intraday Setups/);
  assert.match(html, /\/app\/todays-intraday-setups\?session=regular/);
  assert.match(html, /No execution controls/);
  assert.match(html, /Order submitted/);
});
