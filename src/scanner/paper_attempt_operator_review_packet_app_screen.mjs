import { buildPaperAttemptOperatorReviewPacketPanel } from "./paper_attempt_operator_review_packet_panel.mjs";
export const VERSION = "paper_attempt_operator_review_packet_app_screen_v1";
const A=v=>Array.isArray(v)?v:[];
const S=(v,f="")=>String(v??"").trim()||f;
const F=false;
const E=v=>S(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const fastDefaultPanel=()=>({ok:false,version:"paper_attempt_operator_review_packet_panel_fast_preview_v1",status:"fast_preview_readonly",displayState:"OPERATOR_REVIEW_PACKET_FAST_PREVIEW_READONLY",blockers:["source_panel_not_supplied"],blockerCount:1,checklist:[]});
const P=o=>o.panel??o.source??o.result??(o.loadSourcePanel===false?fastDefaultPanel():buildPaperAttemptOperatorReviewPacketPanel(o));
const U=v=>[...new Set(v.flat().map(x=>S(x)).filter(Boolean))];
export function buildPaperAttemptOperatorReviewPacketAppScreen(o={}){
 const p=P(o);
 const checks=A(p.checklist).map((x,i)=>{const k=S(x.id??x.key??x.label,`check_${i+1}`),ok=(x.passed??x.ok??x.ready)===true;return{index:i+1,key:k,label:S(x.label??k.replaceAll("_"," ")),ok,status:ok?"pass":"blocked",detail:S(x.detail??x.reason??x.message),readOnly:true,noExecutionControls:true}});
 const failed=checks.filter(x=>!x.ok).map(x=>x.key);
 const blockers=U([A(p.blockers),A(p.blockReasons),A(p.issues),A(p.errors),A(p.packet?.blockers),A(p.packet?.warnings),failed]);
 const blockerCount=Math.max(blockers.length,Number(p.blockerCount??0)||0);
 const ready=p.ok===true&&blockerCount===0,now=(o.now instanceof Date?o.now:new Date()).toISOString();
 return{ok:true,version:VERSION,panelType:"mobile_app_screen",title:S(o.title,"Operator Review Packet"),subtitle:S(o.subtitle,"Read-only operator review packet. No broker contact and no order placement."),displayState:ready?"OPERATOR_REVIEW_PACKET_APP_SCREEN_READY_REVIEW_ONLY":"OPERATOR_REVIEW_PACKET_APP_SCREEN_BLOCKED_READONLY",sourceVersion:p.version??null,sourceDisplayState:p.displayState??p.status??null,finalDecision:"NO_GO_FOR_ORDER_PLACEMENT",readyForHumanReview:ready,readyForOrderPlacement:F,blockerCount,blockers,checkCount:checks.length,visibleCheckCount:checks.length,checks,generatedAt:now,lastUpdatedAt:now,autoRefreshEnabled:o.autoRefreshEnabled!==false,refreshIntervalSec:Number(o.refreshIntervalSec??o.refresh??30)||30,readOnly:true,monitorOnly:true,diagnosticsOnly:true,reviewOnly:true,noExecutionControls:true,brokerContactAllowed:F,orderSubmitAllowed:F,orderPlacementAllowed:F,paperOrderPlacementAllowed:F,accountMutationAllowed:F,liveTradingAllowed:F,autoTradingAllowed:F,orderSubmitted:F,brokerContactAttempted:F,accountMutationAttempted:F};
}
export function renderPaperAttemptOperatorReviewPacketAppScreenHtml(s={}){
 const x=s.version?s:buildPaperAttemptOperatorReviewPacketAppScreen(s);
 const rows=A(x.checks).map(c=>`<p>${E(c.label)}: ${E(c.status)} ${E(c.detail)}</p>`).join("");
 const r=x.autoRefreshEnabled?`<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${Math.max(5,x.refreshIntervalSec)*1000});</script>`:"";
 return`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(x.title)}</title></head><body><main><h1>${E(x.title)}</h1><p>${E(x.subtitle)}</p><p>${E(x.displayState)}</p>${rows}<p>Read-only. Review only. No broker contact. No order placement.</p><p>readyForOrderPlacement=${E(x.readyForOrderPlacement)} orderPlacementAllowed=${E(x.orderPlacementAllowed)} brokerContactAttempted=${E(x.brokerContactAttempted)}</p><p><a href="/app">Back to GeminiScanner App</a></p>${r}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}
export default buildPaperAttemptOperatorReviewPacketAppScreen;
