export const VERSION="customer_owned_position_signal_router_v1";
const list=v=>Array.isArray(v)?v:[];
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const sym=v=>String(v??"").trim().toUpperCase();
const state=c=>String(c?.resultState??c?.decision??"NO_SETUP").toUpperCase();
const sort=(a,b)=>(num(b?.readonlyPotentialScore)??-1)-(num(a?.readonlyPotentialScore)??-1)||sym(a?.symbol).localeCompare(sym(b?.symbol));
export function routeCustomerOwnedPositionSignals(candidates=[],paperAccount={}){
 const owned=new Map(list(paperAccount?.positions).filter(p=>(num(p?.qty)??0)>0).map(p=>[sym(p?.symbol),p]));
 const scannerCandidates=[],exitAlerts=[],scaleOutReviews=[],scaleInReviews=[],monitoredOwned=[];
 for(const candidate of list(candidates)){
  const symbol=sym(candidate?.symbol),position=owned.get(symbol);
  if(!position){
   if(state(candidate)!=="EXIT")scannerCandidates.push(candidate);
   continue;
  }
  const base={...candidate,symbol,ownedPosition:position,ownedPositionQty:num(position?.qty),ownedAverageEntryPrice:num(position?.averageEntryPrice??position?.avgEntryPrice),hiddenFromOpportunityResults:true,readOnly:true,paperOnly:true,brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false};
  if(state(candidate)==="EXIT"){exitAlerts.push({...base,alertType:"OWNED_POSITION_EXIT",priority:"highest",visualAlert:true,audioAlertEligible:true,notificationEligible:true});continue;}
  if(candidate?.ownedScaleOutReviewTriggered===true){scaleOutReviews.push({...base,alertType:"OWNED_POSITION_SCALE_OUT_REVIEW",priority:"review",scaleOutReady:false});continue;}
  if(state(candidate)==="ENTER"){scaleInReviews.push({...base,alertType:"OWNED_POSITION_SCALE_IN_REVIEW",priority:"review",scaleInReady:false});continue;}
  monitoredOwned.push({...base,alertType:"OWNED_POSITION_MONITOR"});
 }
 return Object.freeze({version:VERSION,scannerCandidates:Object.freeze(scannerCandidates),exitAlerts:Object.freeze(exitAlerts.sort(sort)),scaleOutReviews:Object.freeze(scaleOutReviews.sort(sort)),scaleInReviews:Object.freeze(scaleInReviews.sort(sort)),monitoredOwned:Object.freeze(monitoredOwned.sort(sort)),safety:Object.freeze({readOnly:true,paperOnly:true,decisionAssistOnly:true,automaticExitAllowed:false,automaticScaleOutAllowed:false,automaticScaleInAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false})});
}
