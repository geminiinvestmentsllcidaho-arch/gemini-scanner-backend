import fs from 'node:fs'
import path from 'node:path'
import { buildPaperScaleActionIdentity } from './paper_auto_execution_scale_action_model.mjs'

export const VERSION='paper_auto_execution_scale_action_store_v1'
export const STATES=Object.freeze({
  PREPARED:'PREPARED',SUBMITTING:'SUBMITTING',UNKNOWN:'UNKNOWN',OPEN:'OPEN',
  PARTIALLY_FILLED:'PARTIALLY_FILLED',FILLED_RECONCILED:'FILLED_RECONCILED',
  FAILED_NEEDS_REVIEW:'FAILED_NEEDS_REVIEW',
})
const S=STATES
const unresolved=new Set([S.PREPARED,S.SUBMITTING,S.UNKNOWN,S.OPEN,S.PARTIALLY_FILLED,S.FAILED_NEEDS_REVIEW])
const transitions=new Map([
  [S.PREPARED,new Set([S.SUBMITTING,S.FAILED_NEEDS_REVIEW])],
  [S.SUBMITTING,new Set([S.UNKNOWN,S.OPEN,S.PARTIALLY_FILLED,S.FILLED_RECONCILED,S.FAILED_NEEDS_REVIEW])],
  [S.UNKNOWN,new Set([S.OPEN,S.PARTIALLY_FILLED,S.FILLED_RECONCILED,S.FAILED_NEEDS_REVIEW])],
  [S.OPEN,new Set([S.PARTIALLY_FILLED,S.FILLED_RECONCILED,S.FAILED_NEEDS_REVIEW])],
  [S.PARTIALLY_FILLED,new Set([S.FILLED_RECONCILED,S.FAILED_NEEDS_REVIEW])],
])
const copy=v=>JSON.parse(JSON.stringify(v))
const clean=v=>String(v??'').trim()

export class PaperAutoExecutionScaleActionStore{
  constructor({filePath,clock=()=>Date.now()}={}){
    if(!clean(filePath))throw new Error('paper_scale_store_file_required')
    this.filePath=filePath;this.clock=clock
  }
  load(){
    if(!fs.existsSync(this.filePath))return null
    let v
    try{v=JSON.parse(fs.readFileSync(this.filePath,'utf8'))}catch{throw new Error('paper_scale_store_corrupt')}
    if(!v||v.version!==VERSION||!Number.isSafeInteger(v.lastSequence)||v.lastSequence<0)throw new Error('paper_scale_store_invalid')
    if(v.current){
      if(!Object.values(S).includes(v.current.state)||v.current.actionSequence!==v.lastSequence)throw new Error('paper_scale_store_invalid')
      let identity
      try{
        identity=buildPaperScaleActionIdentity({
          lifecycleId:v.current.lifecycleId,
          action:v.current.action,
          symbol:v.current.symbol,
          fromQuantity:v.current.fromQuantity,
          targetQuantity:v.current.targetQuantity,
          actionSequence:v.current.actionSequence,
        })
      }catch{throw new Error('paper_scale_store_invalid')}
      for(const key of ['version','lifecycleId','action','symbol','actionSequence','fromQuantity','targetQuantity','quantity','side','canonical','digest','clientOrderId','paperOnly','liveTradingAllowed']){
        if(v.current[key]!==identity[key])throw new Error('paper_scale_store_invalid')
      }
    }
    return copy(v)
  }
  hasUnresolved(){return unresolved.has(this.load()?.current?.state)}
  mutationLocked(){return this.hasUnresolved()}
  prepare({lifecycleId,action,symbol,fromQuantity,targetQuantity}={}){
    const prior=this.load()
    if(unresolved.has(prior?.current?.state))throw new Error('paper_scale_unresolved_action_exists')
    const actionSequence=(prior?.lastSequence??0)+1
    const identity=buildPaperScaleActionIdentity({lifecycleId,action,symbol,fromQuantity,targetQuantity,actionSequence})
    const now=new Date(this.clock()).toISOString()
    const value={version:VERSION,lastSequence:actionSequence,current:{...identity,state:S.PREPARED,brokerOrderId:null,preparedAt:now,updatedAt:now}}
    this.#write(value)
    return copy(value.current)
  }
  transition({expectedActionSequence,expectedClientOrderId,expectedState,nextState,patch={}}={}){
    const value=this.load()
    const current=value?.current
    if(!current)throw new Error('paper_scale_action_missing')
    if(!Number.isSafeInteger(expectedActionSequence)||expectedActionSequence!==current.actionSequence)throw new Error('paper_scale_action_sequence_changed')
    if(clean(expectedClientOrderId)!==current.clientOrderId)throw new Error('paper_scale_action_client_order_id_changed')
    if(clean(expectedState)!==current.state)throw new Error('paper_scale_action_state_changed')
    if(!transitions.get(current.state)?.has(nextState))throw new Error(`paper_scale_transition_invalid:${current.state}->${nextState}`)
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('paper_scale_transition_patch_invalid')
    const allowedPatchKeys=new Set(['brokerOrderId','brokerOrderStatus','submissionError','submissionRejected','failureReason','reconciledAt','observedFilledQuantity'])
    for(const key of Object.keys(patch))if(!allowedPatchKeys.has(key))throw new Error(`paper_scale_transition_patch_forbidden:${key}`)
    const next={...current,...copy(patch),state:nextState,updatedAt:new Date(this.clock()).toISOString()}
    this.#write({...value,current:next})
    return copy(next)
  }
  #write(value){
    fs.mkdirSync(path.dirname(this.filePath),{recursive:true})
    const temp=`${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(temp,`${JSON.stringify(value,null,2)}\n`,{mode:0o600})
    fs.renameSync(temp,this.filePath)
  }
}
export default{VERSION,STATES,PaperAutoExecutionScaleActionStore}
