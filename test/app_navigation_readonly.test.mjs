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
  assert.ok(nav.entryCount >= 14);
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

  const settingsEntry = nav.entries.find((item) => item.id === "watchlist_settings");
  assert.ok(settingsEntry);
  assert.equal(settingsEntry.title, "Watchlist & Settings");
  assert.equal(settingsEntry.href, "/app/watchlist-settings");
  assert.equal(settingsEntry.diagnosticHref, "/diagnostics/watchlist-settings-readonly");
  assert.equal(settingsEntry.routeHref, "/diagnostics/watchlist-settings-readonly");
  assert.equal(settingsEntry.displayState, "WATCHLIST_SETTINGS_READY_READONLY");
  assert.equal(settingsEntry.readOnly, true);
  assert.equal(settingsEntry.orderPlacementAllowed, false);
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


test("app navigation exposes all built website options", () => {
  const nav = buildAppNavigationReadonly({ now: new Date("2026-07-02T19:30:00Z") });
  const ids = new Set(nav.entries.map((entry) => entry.id));
  for (const id of [
    "todays_intraday_setups",
    "watchlist_settings",
    "exit_all_control",
    "market_closed_snapshot",
    "snapshot_history",
    "snapshot_store_panel",
    "retention_cleanup_preview",
    "paper_readiness_gate",
    "paper_trade_intent_plan",
    "paper_attempt_control_center",
    "operator_review_packet",
    "audit_dashboard",
    "module_complete_selector",
    "readonly_operator_summary",
  ]) {
    assert.equal(ids.has(id), true, id);
  }

  for (const entry of nav.entries) {
    assert.equal(entry.readOnly, true);
    assert.equal(entry.monitorOnly, true);
    assert.equal(entry.noExecutionControls, true);
    assert.equal(entry.orderSubmitAllowed, false);
    assert.equal(entry.orderPlacementAllowed, false);
    assert.equal(entry.brokerContactAllowed, false);
    assert.equal(entry.accountMutationAllowed, false);
  }
});
