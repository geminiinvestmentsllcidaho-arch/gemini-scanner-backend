import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { buildPremarketCapitalBaseline } from './premarket_capital_baseline.mjs'
import { easternDateKey } from './alpaca_premarket_shared_scan_cache.mjs'
import { DEFAULT_FILE, readPremarketCapitalBaselineForSession, writePremarketCapitalBaseline } from './premarket_capital_baseline_store.mjs'
import { DEFAULT_AUDIT_FILE, ensurePremarketCapitalBaselineAuditRecord, readPremarketCapitalBaselineAudit } from './premarket_capital_baseline_audit_store.mjs'
export const VERSION='premarket_capital_baseline_runtime_v1'
export async function collectPremarketCapitalBaseline({now=new Date(),fetchPaperAccount=fetchAlpacaPaperAccountReadonly,filePath=DEFAULT_FILE,auditFile=DEFAULT_AUDIT_FILE}={}){
 const at=now instanceof Date?now:new Date(now),sessionDate=easternDateKey(at)
 if(!sessionDate)return Object.freeze({ok:false,status:'PREMARKET_SESSION_DATE_REQUIRED'})
 const existing=readPremarketCapitalBaselineForSession({filePath,sessionDate})
 if(existing){ensurePremarketCapitalBaselineAuditRecord({auditFile,sessionDate,baseline:existing.baseline});return Object.freeze({...existing.baseline,sessionDate})}
 const account=await fetchPaperAccount()
 if(account?.ok!==true||account?.status!=='connected_readonly'||account?.mode!=='PAPER_ONLY')return Object.freeze({ok:false,status:'PAPER_READONLY_ACCOUNT_REQUIRED'})
 const baseline=buildPremarketCapitalBaseline({paperAccount:{...account,paperOnly:true,readOnly:true},observedAt:account.observedAt??at})
 if(baseline.ok!==true)return baseline
 ensurePremarketCapitalBaselineAuditRecord({auditFile,sessionDate,baseline})
 writePremarketCapitalBaseline({filePath,sessionDate,baseline})
 return Object.freeze({...baseline,sessionDate})
}
export function getPersistedPremarketCapitalBaseline({now=new Date(),filePath=DEFAULT_FILE,auditFile=DEFAULT_AUDIT_FILE}={}){
 const sessionDate=easternDateKey(now)
 if(!sessionDate)return null
 const record=readPremarketCapitalBaselineForSession({filePath,sessionDate})
 if(!record)return null
 const audited=readPremarketCapitalBaselineAudit({auditFile}).find(x=>x?.sessionDate===sessionDate)
 if(!audited||JSON.stringify(audited.baseline)!==JSON.stringify(record.baseline))return null
 return Object.freeze({...record.baseline,sessionDate})
}
export default{VERSION,collectPremarketCapitalBaseline,getPersistedPremarketCapitalBaseline}
