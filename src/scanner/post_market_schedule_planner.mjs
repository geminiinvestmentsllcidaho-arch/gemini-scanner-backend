export const VERSION="post_market_schedule_planner_v1";
const TZ="America/New_York",START=975,END=1200,FINAL=1205,INTERVAL=15;
function parts(v){const d=new Date(v),a=new Intl.DateTimeFormat("en-US",{timeZone:TZ,weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(d),o=Object.fromEntries(a.map(x=>[x.type,x.value]));return{weekday:o.weekday,year:+o.year,month:+o.month,day:+o.day,hour:+o.hour===24?0:+o.hour,minute:+o.minute};}
function key(p){return`${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;}
function clock(c,...ks){for(const k of ks){const d=new Date(c?.[k]);if(!Number.isNaN(d.getTime()))return d;}return null;}
function utc(p){let g=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);for(let i=0;i<3;i++){const a=parts(g),x=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-Date.UTC(a.year,a.month-1,a.day,a.hour,a.minute);if(!x)break;g+=x;}return g;}
function add(p,n){const d=new Date(Date.UTC(p.year,p.month-1,p.day+n,12));return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};}
function nextWeekday(p){for(let n=1;n<9;n++){const d=add(p,n);if(!["Sat","Sun"].includes(parts(utc({...d,hour:12,minute:0})).weekday))return d;}return add(p,1);}
function start(p){return utc({...p,hour:16,minute:15});}
export function buildPostMarketSchedulePlan(o={}){
 const now=new Date(o.now??Date.now());if(Number.isNaN(now.getTime()))throw new TypeError("invalid_now");
 const p=parts(now),m=p.hour*60+p.minute,weekend=["Sat","Sun"].includes(p.weekday),c=o.marketClock??{},next=clock(c,"next_open","nextOpen"),np=next?parts(next):null;
 const session=typeof o.currentSessionWasOpen==="boolean"?o.currentSessionWasOpen:!weekend&&(!next||key(np)===key(p)||(c.is_open??c.isOpen)===true||(clock(c,"timestamp")&&key(parts(clock(c,"timestamp")))===key(p)&&m>=960));
 const regular=session&&!weekend&&m>=START&&m<=END,final=session&&!weekend&&m===FINAL,run=regular||final;
 let state=run?(final?"final_cycle_due":"scan_due"):weekend?"weekend_sleep":!session?"market_closed_no_session":m<START?"waiting_for_postmarket":m<FINAL?"waiting_for_final_cycle":"final_cycle_complete_sleep";
 let nextMs;
 if(regular){const nm=START+(Math.floor((m-START)/INTERVAL)+1)*INTERVAL;nextMs=nm<=END?utc({...p,hour:Math.floor(nm/60),minute:nm%60}):utc({...p,hour:20,minute:5});}
 else if(session&&!weekend&&m<START)nextMs=start(p);
 else if(session&&!weekend&&m>END&&m<FINAL)nextMs=utc({...p,hour:20,minute:5});
 else nextMs=start(np??nextWeekday(p));
 if(nextMs<=now.getTime())nextMs=now.getTime()+60000;
 const tomorrow=key(add(p,1)),closedNext=Boolean(np&&key(np)!==tomorrow),days=np?Math.max(0,Math.round((Date.UTC(np.year,np.month-1,np.day)-Date.UTC(p.year,p.month-1,p.day))/86400000)):null;
 return Object.freeze({version:VERSION,generatedAt:now.toISOString(),timeZone:TZ,shouldRunNow:run,schedulerState:state,finalCycle:final,currentSessionWasOpen:session,nextCycleAt:new Date(nextMs).toISOString(),nextValidSessionAt:next?.toISOString()??null,daysUntilNextOpen:days,marketClosedNextCalendarDay:closedNext,sleepUntilNextRelevantWindow:!run,intervalMinutes:INTERVAL,nextSessionTerminology:"NEXT_OPEN_SESSION",readOnly:true,paperOnly:true,decisionAssistOnly:true,automaticLearningAllowed:false,scannerLogicMutationAllowed:false,thresholdMutationAllowed:false,orderPlacementAllowed:false,brokerContactAllowed:false,accountMutationAllowed:false});
}
export default Object.freeze({VERSION,buildPostMarketSchedulePlan});
