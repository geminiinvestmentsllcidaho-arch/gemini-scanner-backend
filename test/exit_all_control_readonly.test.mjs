import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExitAllControlReadonly,
  renderExitAllControlReadonlyHtml,
} from "../src/scanner/exit_all_control_readonly.mjs";

test("exit all control is locked and read-only", () => {
  const model = buildExitAllControlReadonly({
    now: new Date("2026-07-02T20:30:00Z"),
    requestedAction: "exit_all",
    inventorySource: "future_broker",
    futureAutoModeKnown: true,
  });

  assert.equal(model.ok, true);
  assert.equal(model.displayState, "EXIT_ALL_CONTROL_LOCKED_READONLY");
  assert.equal(model.exitAllRequested, false);
  assert.equal(model.autoBuyPauseRequested, false);
  assert.equal(model.resumeAutoBuyRequested, false);
  assert.equal(model.canPauseNewBuysNow, false);
  assert.equal(model.canLiquidateInventoryNow, false);
  assert.equal(model.canResumeAutoBuyingNow, false);

  assert.equal(model.readOnly, true);
  assert.equal(model.monitorOnly, true);
  assert.equal(model.diagnosticsOnly, true);
  assert.equal(model.noExecutionControls, true);
  assert.equal(model.orderSubmitAllowed, false);
  assert.equal(model.orderPlacementAllowed, false);
  assert.equal(model.brokerContactAllowed, false);
  assert.equal(model.accountMutationAllowed, false);
  assert.equal(model.liveTradingAllowed, false);
  assert.equal(model.autoTradingAllowed, false);
  assert.equal(model.sellOrderPlacementAllowed, false);
  assert.equal(model.liquidationAllowed, false);
  assert.equal(model.retryAllowed, false);
  assert.equal(model.orderSubmitted, false);
  assert.equal(model.brokerContactAttempted, false);
  assert.equal(model.accountMutationAttempted, false);
  assert.equal(model.inventoryMutationAttempted, false);
});

test("exit all control html renders without mutation controls", () => {
  const html = renderExitAllControlReadonlyHtml(buildExitAllControlReadonly({
    now: new Date("2026-07-02T20:30:00Z"),
  }));

  assert.match(html, /Exit All \/ Auto-Buy Pause/);
  assert.match(html, /EXIT_ALL_CONTROL_LOCKED_READONLY/);
  assert.match(html, /Exit All locked/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No liquidation/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /\bfetch\s*\(/i);
  assert.doesNotMatch(html, /\bXMLHttpRequest\b/i);
});
