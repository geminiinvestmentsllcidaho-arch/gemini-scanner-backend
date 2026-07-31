export const VERSION = "customer_stage1_exit_alert_panel_v1";
function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
export function buildCustomerStage1ExitAlertPanel(options={}){
 const status=options.status??{},tracker=status.tracker??{},operator=status.operator??{};
 const monitoring=tracker.enterDetected===true&&tracker.exitDetected!==true;
 const symbol=String(tracker.symbol??operator.symbol??"").trim().toUpperCase()||null;
 const alertKey=symbol&&tracker.enterDetectedAt?`${symbol}-${String(tracker.enterDetectedAt).replace(/[^0-9A-Za-z]/g,"").slice(0,24)}`:null;
 return Object.freeze({version:VERSION,active:monitoring&&Boolean(symbol),symbol,alertKey,enteredAt:tracker.enterDetectedAt??null,visualAlert:true,audioAlertEligible:true,browserNotificationEligible:true,acknowledgementLocalOnly:true,automaticExitAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,stage2Locked:true,stage3Locked:true});
}
export function renderCustomerStage1ExitAlertPanelHtml(panel={}){
 if(panel.active!==true)return "";
 return `<section class="card panel stage1-exit-alert" role="alert" data-stage1-exit-alert data-alert-key="${esc(panel.alertKey)}"><p class="stage1-kicker">Stage 1 • Manual EXIT monitoring</p><h2>URGENT PAPER POSITION EXIT REVIEW</h2><p><strong>${esc(panel.symbol)}</strong> is the one-share Stage 1 paper position currently being monitored.</p><p><strong>Entry detected:</strong> ${esc(panel.enteredAt??"Timestamp unavailable")}</p><div class="stage1-exit-actions"><button type="button" data-enable-stage1-exit-alerts>Enable EXIT sound and notifications</button><button type="button" class="secondary-button" data-ack-stage1-exit-alert>Acknowledge alert on this device</button></div><p data-stage1-alert-status>Visual EXIT alert is active. Sound and browser notifications require your tap and browser permission.</p><p class="helper">You must manually review and close the position in the Alpaca paper interface. GeminiScanner cannot place, cancel, replace, or modify an order. Acknowledgement is deduplicated locally by this Stage 1 position identity and does not complete the mechanical proof.</p></section>`;
}
export default{VERSION,buildCustomerStage1ExitAlertPanel,renderCustomerStage1ExitAlertPanelHtml};
