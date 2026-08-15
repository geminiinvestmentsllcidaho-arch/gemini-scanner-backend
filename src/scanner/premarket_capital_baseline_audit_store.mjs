import fs from 'node:fs'
import path from 'node:path'

export const VERSION='dremarket_capital_baseline_audit_store_v1'
export const DEFAULT_AUDIT_FILE=path.resolve('runs/premarket_capital_baseline_audit.jsoln')

const c=v=>String(v??'').trim()
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(c(v))
const validBaseline=b=>b?.ok===true&&b?.paperOnly===true&&b?.readOnly===true&&
 /^alpaca-paper:[0-9a-f]{24}$/.test(c(b?.accountIdentity))&&
 Number.isFinite(Number(b?.accountEquity))&&Number(b.accountEquity)>0&&
 Number.isFinite(Number(b?.buyingPower))&&Number(b.buyingPower)>=0&&
 Number.isFinite(Date.parse(b?.observedAt))
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)

export function readPremarketCapitalBaselineAudit({auditFile=DEFAULT_AUDIT_FILE}={}){
 const f=path.resolve(auditFile)
 if(!fs.existsSync(f))return[]
 let text
 try{text=fs.readFileSync(f,'utf8')}catch{throw Error('premarket_capital_baseline_audit_read_failed')}
 const records=[]
 for(const line of text.split('\n')){
  if(!line.trim())continue
  let record
  try{record=JSON.parse(line)}catch{throw Error('premarket_capital_baseline_audit_malformed_ledger')}
  if(record?.version!==VERSION||!validDate(record?.sessionDate)||!validBaseline(record?.baseline)){
   throw Error('premarket_capital_baseline_audit_invalid_ledger_record')
  }
  records.push(record)
 }
 return records
}

export function ensurePremarketCapitalBaselineAuditRecord({auditFile=DEFAULT_AUDIT_FILE,sessionDate,baseline}={}){
 if(!validDate(sessionDate))throw Error('premarket_capital_baseline_audit_session_date_required')
 if(!validBaseline(baseline))throw Error('premarket_capital_baseline_audit_invalid')
 const f=path.resolve(auditFile),dir=path.dirname(f),d=c(sessionDate)
 fs.mkdirSync(dir,{recursive:true,mode:0o700})
 const lock=`${f}.${d}.lock`
 let lockHeld=false
 try{
  let lfd
  try{lfd=fs.openSync(lock,'wx',0o600)}catch(e){
   if(e?.code==='EEXIST')throw Error('premarket_capital_baseline_audit_session_lock_held')
   throw e
  }
  try{fs.writeFileSync(lfd,`${process.pid}\n`);fs.fsyncSync(lfd)}finally{fs.closeSync(lfd)}
  lockHeld=true
  const record={version:VERSION,sessionDate:d,baseline:{...baseline}}
  const prior=readPremarketCapitalBaselineAudit({auditFile:f}).find(x=>x.sessionDate===d)
  if(prior){
   if(!same(prior,record))throw Error('premarket_capital_baseline_audit_session_conflict')
   return Object.freeze({...prior,appended:false})
  }
  const fd=fs.openSync(f,'a',0o600)
  try{fs.writeFileSync(fd,`${JSON.stringify(record)}\n`);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  const dirFd=fs.openSync(dir,'r')
  try{fs.fsyncSync(dirFd)}finally{fs.closeSync(dirFd)}
  return Object.freeze({...record,appended:true})
 }finally{
  if(lockHeld){
   try{fs.unlinkSync(lock)}catch{throw Error('premarket_capital_baseline_audit_session_lock_release_failed')}
  }
 }
}

export default{VERSION,DEFAULT_AUDIT_FILE,readPremarketCapitalBaselineAudit,ensurePremarketCapitalBaselineAuditRecord}
