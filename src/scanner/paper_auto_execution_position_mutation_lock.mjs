import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';
export const VERSION='paper_auto_execution_position_mutation_lock_v1';const c=v=>String(v??'').trim();
export function derivePaperPositionMutationLockFile(f){f=c(f);if(!f)throw Error('paper_position_mutation_lifecycle_file_required');return`${path.resolve(f)}.position_mutation.lock`}
const read=f=>{try{const s=fs.statSync(f),j=JSON.parse(fs.readFileSync(f,'utf8'));return{...j,ino:s.ino,dev:s.dev,mtimeMs:s.mtimeMs}}catch{return null}};
const dead=pid=>{try{process.kill(pid,0);return false}catch(e){return e?.code==='ESRCH'}};
const same=(f,o)=>{const x=read(f);return!!x&&x.token===o.token&&x.ino===o.ino&&x.dev===o.dev};
export function acquirePaperPositionMutationLock({lockFile,lifecycleId,symbol,action,now=Date.now,tokenFactory=crypto.randomUUID,ownerDefinitelyDead=dead,staleMs=30000}={}){
 const f=c(lockFile),l=c(lifecycleId),s=c(symbol).toUpperCase(),a=c(action).toLowerCase();
 if(!f)throw Error('paper_position_mutation_lock_file_required');if(!l)throw Error('paper_position_mutation_lifecycle_id_required');
 if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(s))throw Error('paper_position_mutation_symbol_invalid');
 if(!['scale_in','scale_out','exit'].includes(a))throw Error('paper_position_mutation_action_invalid');
 fs.mkdirSync(path.dirname(f),{recursive:true,mode:0o700});const t=c(tokenFactory());if(!t)throw Error('paper_position_mutation_token_required');
 const create=()=>{const fd=fs.openSync(f,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify({version:VERSION,pid:process.pid,createdAtMs:Number(now()),token:t,lifecycleId:l,symbol:s,action:a})+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
 try{create()}catch(e){
  if(e?.code!=='EEXIST')throw e
  const o=read(f),age=o?Math.max(0,Number(now())-Number(o.mtimeMs)):0
  if(!o||!Number.isInteger(Number(o.pid))||Number(o.pid)<=0||!Number.isFinite(age)||age<Number(staleMs)||!ownerDefinitelyDead(Number(o.pid))||!same(f,o))return Object.freeze({ok:false,status:'POSITION_MUTATION_LOCK_HELD',lockFile:f})
  const q=`${f}.stale-${c(tokenFactory())||crypto.randomUUID()}`
  try{fs.renameSync(f,q)}catch{return Object.freeze({ok:false,status:'POSITION_MUTATION_LOCK_HELD',lockFile:f})}
  const z=read(q)
  if(!z||z.token!==o.token||z.ino!==o.ino||z.dev!==o.dev){try{if(!fs.existsSync(f)&&fs.existsSync(q))fs.renameSync(q,f)}catch{};return Object.freeze({ok:false,status:'POSITION_MUTATION_LOCK_HELD',lockFile:f})}
  try{create();try{fs.rmSync(q,{force:true})}catch{}}
  catch(r){try{if(!fs.existsSync(f)&&fs.existsSync(q))fs.renameSync(q,f)}catch{};if(r?.code==='EEXIST')return Object.freeze({ok:false,status:'POSITION_MUTATION_LOCK_HELD',lockFile:f});throw r}
 }
 const o=read(f);if(!o||o.token!==t)throw Error('paper_position_mutation_lock_acquire_verify_failed');
 return Object.freeze({ok:true,status:'POSITION_MUTATION_LOCK_ACQUIRED',lockFile:f,token:t,ino:o.ino,dev:o.dev,lifecycleId:l,symbol:s,action:a})
}
export function releasePaperPositionMutationLock(x={}){
 if(x?.ok!==true||c(x?.status)!=='POSITION_MUTATION_LOCK_ACQUIRED')throw Error('paper_position_mutation_lock_owner_required');
 const f=c(x.lockFile),o=read(f);if(!o)throw Error('paper_position_mutation_lock_missing');
 if(o.token!==x.token)throw Error('paper_position_mutation_lock_token_changed');
 if(o.ino!==x.ino||o.dev!==x.dev)throw Error('paper_position_mutation_lock_identity_changed');
 fs.unlinkSync(f);return Object.freeze({ok:true,status:'POSITION_MUTATION_LOCK_RELEASED',lockFile:f})
}
