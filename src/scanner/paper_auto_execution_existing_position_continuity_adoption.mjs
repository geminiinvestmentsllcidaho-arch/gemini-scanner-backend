import fs from'node:fs';import path from'node:path';import{PaperAutoExecutionLifecycleStore as Store}from'./paper_auto_execution_lifecycle_store.mjs';import{STATES as S}from'./paper_auto_execution_state_machine.mjs';
export const VERSION='paper_auto_execution_existing_position_continuity_adoption_v1',SOURCE='paper_auto_continuity_existing_position_adoption';
const c=v=>String(v??'').trim(),u=v=>c(v).toUpperCase(),n=v=>Number.isFinite(Number(v))?Number(v):null;
export function adoptLegacyPaperMonitoringLifecycleIntoContinuity(o={}){
 if(!c(o.legacyLifecycleFile)||!c(o.targetLifecycleFile))throw Error('paper_continuity_adoption_path_required');
 const lf=path.resolve(o.legacyLifecycleFile),tf=path.resolve(o.targetLifecycleFile),a=o.accountSnapshot,orders=Array.isArray(o.historicalOrders)?o.historicalOrders:[],now=Number(o.nowMs??Date.now());
 if(!/^paper_auto_execution_[A-Za-z0-9._-]+\.json$/.test(path.basename(tf)))throw Error('paper_continuity_adoption_target_filename_invalid');
 if(fs.existsSync(tf))throw Error('paper_continuity_adoption_target_already_exists');
 const l=new Store({filePath:lf}).load();if(!l||l.state!==S.MONITORING)throw Error('paper_continuity_adoption_legacy_monitoring_required');
 const s=u(l.selectedSymbol),q=n(l.filledQuantity);if(!(q>0)||c(l.brokerPositionIdentity)!==`${s}:${q}`||!c(l.enterClientOrderId)||!c(l.enterBrokerOrderId))throw Error('paper_continuity_adoption_legacy_provenance_required');
 if(a?.ok!==true||a?.status!=='connected_readonly')throw Error('paper_continuity_adoption_fresh_account_required');
 const t=Date.parse(a.observedAt??'');if(!Number.isFinite(t)||Math.abs(now-t)>30000)throw Error('paper_continuity_adoption_account_snapshot_stale');
 const pos=(a.positions??[]).filter(p=>u(p.symbol)===s&&n(p.qty??p.quantity)===q);if(pos.length!==1)throw Error('paper_continuity_adoption_exact_broker_position_required');
 if((a.openOrders??[]).some(x=>['buy','sell'].includes(c(x.side).toLowerCase())))throw Error('paper_continuity_adoption_global_open_order_conflict');
 const hit=orders.filter(x=>c(x.status).toLowerCase()==='filled'&&c(x.side).toLowerCase()==='buy'&&u(x.symbol)===s&&n(x.filled_qty??x.filledQty)===q&&(c(x.id)===c(l.enterBrokerOrderId)||c(x.client_order_id??x.clientOrderId)===c(l.enterClientOrderId)));
 if(hit.length!==1)throw Error('paper_continuity_adoption_enter_order_provenance_required');
 const st=new Store({filePath:tf});let z=st.create({selectedSymbol:s,scannerEvidence:{source:SOURCE,paperOnly:true,symbol:s,state:'MONITORING',adoptedAt:new Date(now).toISOString(),brokerObservedAt:a.observedAt,legacyLifecycleFile:lf,legacyLifecycleId:l.lifecycleId,legacyScannerEvidence:l.scannerEvidence??null}});
 z=st.transition(S.ENTER_SUBMITTING,{enterClientOrderId:l.enterClientOrderId});z=st.transition(S.ENTER_OPEN,{enterBrokerOrderId:l.enterBrokerOrderId});
 z=st.transition(S.POSITION_CONFIRMED,{filledQuantity:q,averageFillPrice:n(l.averageFillPrice)??n(pos[0].averageEntryPrice),brokerPositionIdentity:`${s}:${q}`,reconciliation:[{kind:'existing_position_continuity_adoption',source:SOURCE,legacyLifecycleId:l.lifecycleId,legacyLifecycleFile:lf,adoptedAt:new Date(now).toISOString()}]});z=st.transition(S.MONITORING);
 return Object.freeze({ok:true,version:VERSION,status:'EXISTING_PAPER_POSITION_ADOPTED_INTO_CONTINUITY_MONITORING',lifecycleFile:tf,lifecycle:z,safety:{paperOnly:true,brokerMutationAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false}});
}
