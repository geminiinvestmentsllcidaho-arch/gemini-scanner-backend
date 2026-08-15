import test from'node:test';import assert from'node:assert/strict'
import{arbitratePaperPositionMutation as a}from'../src/scanner/paper_auto_execution_position_mutation_arbiter.mjs'
const l=(state='MONITORING')=>({lifecycleId:'l',selectedSymbol:'ABC',state})
const s=x=>({mutationLocked:()=>x})
const eq=(r,status,allow)=>assert.deepEqual([r.status,r.allow],[status,allow])

test('EXIT precedence and MONITORING-only scale',()=>{
 eq(a({lifecycle:l(),scaleActionStore:s(false),requestedAction:'scale_in'}),'SCALE_MUTATION_ALLOWED',true)
 eq(a({lifecycle:l('POSITION_CONFIRMED'),scaleActionStore:s(false),requestedAction:'scale_out'}),'MONITORING_REQUIRED_FOR_SCALE_MUTATION',false)
 eq(a({lifecycle:l(),scaleActionStore:s(false),requestedAction:'scale_in',exitRequired:true}),'FULL_EXIT_REQUIRED_HAS_PRECEDENCE',false)
 eq(a({lifecycle:l(),scaleActionStore:s(false),requestedAction:'exit',exitRequired:true}),'FULL_EXIT_REQUIRED_HAS_PRECEDENCE',true)
 eq(a({lifecycle:l('EXIT_SUBMITTING'),scaleActionStore:s(false),requestedAction:'scale_out'}),'FULL_EXIT_LIFECYCLE_HAS_PRECEDENCE',false)
})

test('unresolved scale and unreadable lock fail closed',()=>{
 for(const requestedAction of['scale_in','scale_out','exit'])eq(a({lifecycle:l(),scaleActionStore:s(true),requestedAction,exitRequired:true}),'UNRESOLVED_SCALE_MUTATION_BLOCKS_POSITION_MUTATION',false)
 const r=a({lifecycle:l(),scaleActionStore:{mutationLocked(){throw Error('bad')}},requestedAction:'scale_in'})
 assert.deepEqual([r.ok,r.status,r.allow],[false,'SCALE_MUTATION_LOCK_STATE_UNREADABLE',false])
})

test('invalid requests fail closed',()=>{
 eq(a({lifecycle:l(),scaleActionStore:s(false),requestedAction:'exit'}),'FULL_EXIT_NOT_REQUIRED',false)
 let r=a({lifecycle:l(),scaleActionStore:s(false),requestedAction:'bad'})
 assert.deepEqual([r.ok,r.status,r.allow],[false,'POSITION_MUTATION_ACTION_REQUIRED',false])
 r=a({lifecycle:null,scaleActionStore:s(false),requestedAction:'scale_in'})
 assert.deepEqual([r.ok,r.status,r.allow],[false,'POSITION_MUTATION_LIFECYCLE_REQUIRED',false])
})
