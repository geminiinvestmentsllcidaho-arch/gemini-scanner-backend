export const VERSION='alpaca_live_equivalent_equity_fee_model_v1'
export const SCHEDULE=Object.freeze({
  id:'alpaca_brokerage_fee_schedule_2026_07_20',
  revisedOn:'2026-07-20',
  secSellTradeValueRate:0.0000206,
  tafSellPerShareRate:0.000195,
  tafMaxPerTrade:9.79,
  catPerShareRate:0.000003,
  feeDayTimeZone:'America/New_York',
})
const finite=v=>Number.isFinite(Number(v))?Number(v):null
const ts=r=>r?.createdAt??r?.filledAt??r?.timestamp??null
function dayKey(value,timeZone){
  const ms=Date.parse(value); if(!Number.isFinite(ms)) return null
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms))
  const get=t=>parts.find(p=>p.type===t)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
const upCent=v=>v>0?Math.ceil((v-Number.EPSILON)*100)/100:0
const six=v=>Number((v??0).toFixed(6))
export function estimateAlpacaLiveEquivalentEquityFees({fillRecords=[],range,feeDayTimeZone=SCHEDULE.feeDayTimeZone,schedule=SCHEDULE}={}){
  const days=new Map(); let observedFillCount=0,ignoredFillCount=0
  for(const r of Array.isArray(fillRecords)?fillRecords:[]){
    const ms=Date.parse(ts(r)); const start=range?.start instanceof Date?range.start.getTime():-Infinity; const end=range?.end instanceof Date?range.end.getTime():Infinity
    if(!Number.isFinite(ms)||ms<start||ms>end) continue
    const side=String(r?.side??'').trim().toLowerCase(),qty=finite(r?.qty),price=finite(r?.fillPrice),day=dayKey(ts(r),feeDayTimeZone)
    if(!['buy','sell'].includes(side)||!(qty>0)||!(price>0)||!day){ignoredFillCount++;continue}
    observedFillCount++
    const b=days.get(day)??{secRaw:0,tafRaw:0,catRaw:0,fillCount:0}
    b.fillCount++; b.catRaw+=qty*schedule.catPerShareRate
    if(side==='sell'){b.secRaw+=qty*price*schedule.secSellTradeValueRate;b.tafRaw+=Math.min(qty*schedule.tafSellPerShareRate,schedule.tafMaxPerTrade)}
    days.set(day,b)
  }
  const daily=[...days.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([day,b])=>Object.freeze({
    day,fillCount:b.fillCount,secRaw:six(b.secRaw),tafRaw:six(b.tafRaw),catRaw:six(b.catRaw),
    secFee:upCent(b.secRaw),tafFee:upCent(b.tafRaw),catFee:upCent(b.catRaw),
    totalFee:Number((upCent(b.secRaw)+upCent(b.tafRaw)+upCent(b.catRaw)).toFixed(2)),
  }))
  const sum=k=>Number(daily.reduce((s,d)=>s+d[k],0).toFixed(2))
  return Object.freeze({
    version:VERSION,model:'ALPACA_LIVE_EQUIVALENT_REGULATORY_FEES',scheduleId:schedule.id,scheduleRevisedOn:schedule.revisedOn,
    feeDayTimeZone,secFee:sum('secFee'),tafFee:sum('tafFee'),catFee:sum('catFee'),
    totalFees:Number((sum('secFee')+sum('tafFee')+sum('catFee')).toFixed(2)),
    observedFillCount,ignoredFillCount,daily:Object.freeze(daily),
    estimationOnly:true,paperBrokerActualFees:false,commissionIncluded:false,readOnly:true,paperOnlyInput:true,
    brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,
  })
}
export default {VERSION,SCHEDULE,estimateAlpacaLiveEquivalentEquityFees}
