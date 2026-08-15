import fs from 'node:fs'
import path from 'node:path'
export const VERSION='premarket_capital_baseline_store_v1'
export const DEFAULT_FILE=path.resolve('runs/premarket_capital_baseline.json')
const c=v=>String(v??'').trim()
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(c(v))
function validBaseline(b){
 return b?.ok===true&&b?.paperOnly===true&&b?.readOnly===true&&
  /^alpaca-paper:[0-9a-f]{24}$/.test(c(b?.accountIdentity))&&
  Number.isFinite(Number(b?.accountEquity))&&Number(b.accountEquity)>0&&
  Number.isFinite(Number(b?.buyingPower))&&Number(b.buyingPower)>=0&&
  Number.isFinite(Date.parse(b?.observedAt))
}
export function readPremarketCapitalBaseline({filePath=DEFAULT_FILE}={}){
 try{
  const x=JSON.parse(fs.readFileSync(path.resolve(filePath),'utf8'))
  if(x?.version!==VERSION||!validDate(x?.sessionDate)||!validBaseline(x?.baseline)) return null
  return Object.freeze({version:VERSION,sessionDate:x.sessionDate,baseline:Object.freeze({...x.baseline})})
 }catch{return null}
}
export function writePremarketCapitalBaseline({filePath=DEFAULT_FILE,sessionDate,baseline}={}){
 const f=path.resolve(filePath)
 if(!validDate(sessionDate)) throw Error('premarket_capital_baseline_session_date_required')
 if(!validBaseline(baseline)) throw Error('premarket_capital_baseline_invalid')
 const dir=path.dirname(f)
 fs.mkdirSync(dir,{recursive:true,mode:0o700})
 const tmp=`${f}.tmp-${process.pid}-${Date.now()}`
 const payload={version:VERSION,sessionDate:c(sessionDate),baseline:{...baseline}}
 let fileFd=null
 try{
  fileFd=fs.openSync(tmp,'w',0o600)
  fs.writeFileSync(fileFd,`${JSON.stringify(payload,null,2)}\n`)
  fs.fsyncSync(fileFd)
  fs.closeSync(fileFd)
  fileFd=null
  fs.renameSync(tmp,f)
  const dirFd=fs.openSync(dir,'r')
  try{fs.fsyncSync(dirFd)}finally{fs.closeSync(dirFd)}
 }catch(error){
  if(fileFd!==null){try{fs.closeSync(fileFd)}catch{}}
  try{fs.rmSync(tmp,{force:true})}catch{}
  throw error
 }
 return readPremarketCapitalBaseline({filePath:f})
}
export function readPremarketCapitalBaselineForSession({filePath=DEFAULT_FILE,sessionDate}={}){
 const x=readPremarketCapitalBaseline({filePath})
 return x?.sessionDate===c(sessionDate)?x:null
}
export default {VERSION,DEFAULT_FILE,readPremarketCapitalBaseline,writePremarketCapitalBaseline,readPremarketCapitalBaselineForSession}
