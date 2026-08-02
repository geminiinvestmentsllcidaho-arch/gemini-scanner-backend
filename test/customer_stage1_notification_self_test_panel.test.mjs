import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildCustomerStage1NotificationSelfTestPanel,
  renderCustomerStage1NotificationSelfTestPanelHtml,
} from "../src/scanner/customer_stage1_notification_self_test_panel.mjs";

test("builds an isolated local-only notification self-test", () => {
  const panel = buildCustomerStage1NotificationSelfTestPanel();
  assert.equal(panel.isolated, true);
  assert.equal(panel.localOnly, true);
  assert.equal(panel.mutatesStage1Evidence, false);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.orderPlacementAllowed, false);
  assert.equal(panel.accountMutationAllowed, false);
  assert.equal(panel.automaticExitAllowed, false);
  assert.equal(panel.stage2Locked, true);
  assert.equal(panel.stage3Locked, true);
});

test("renders a self-test control with explicit non-EXIT language", () => {
  const html = renderCustomerStage1NotificationSelfTestPanelHtml(
    buildCustomerStage1NotificationSelfTestPanel(),
  );
  assert.match(html, /Browser notification self-test/);
  assert.match(html, /Run notification self-test/);
  assert.match(html, /without creating an EXIT signal/);
  assert.doesNotMatch(html, /submit order|cancel order|replace order/i);
});

test("client asset is local-only and does not touch network or Stage 1 storage", () => {
  const asset = fs.readFileSync("public/assets/customer-stage1-notification-self-test.js", "utf8");
  assert.match(asset, /Notification\.requestPermission/);
  assert.match(asset, /AudioContext/);
  assert.match(asset, /navigator\.vibrate/);
  assert.match(asset, /This is not an EXIT signal/);
  assert.doesNotMatch(asset, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|\/v2\/orders/);
});
