export const VERSION = "customer_stage1_notification_self_test_panel_v1";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export function buildCustomerStage1NotificationSelfTestPanel() {
  return Object.freeze({
    version: VERSION,
    visible: true,
    isolated: true,
    localOnly: true,
    mutatesStage1Evidence: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    automaticExitAllowed: false,
    stage2Locked: true,
    stage3Locked: true,
  });
}

export function renderCustomerStage1NotificationSelfTestPanelHtml(panel = {}) {
  if (panel.visible !== true) return "";
  return `<section class="card panel stage1-notification-self-test" data-stage1-notification-self-test>
<p class="stage1-kicker">Stage 1 • Browser notification self-test</p>
<h2>Test sound, vibration, and browser notifications safely</h2>
<p>This isolated test verifies browser alert capability without creating an EXIT signal and without changing Stage 1 evidence.</p>
<div class="stage1-exit-actions">
<button type="button" data-run-stage1-notification-self-test>Run notification self-test</button>
</div>
<p data-stage1-notification-self-test-status>Not tested on this device.</p>
<p class="helper">Local browser test only. No broker contact, order placement, account mutation, evidence mutation, automatic EXIT, or stage unlock.</p>
</section>`;
}

export default {
  VERSION,
  buildCustomerStage1NotificationSelfTestPanel,
  renderCustomerStage1NotificationSelfTestPanelHtml,
};
