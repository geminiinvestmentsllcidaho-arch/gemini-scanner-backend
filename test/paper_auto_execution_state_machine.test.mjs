import test from 'node:test'
import assert from 'node:assert/strict'
import {STATES as S,canTransition,assertTransition,terminalStates} from '../src/scanner/paper_auto_execution_state_machine.mjs'
test('accepts valid transitions',()=>{assert.equal(canTransition(S.IDLE,S.CANDIDATE_SELECTED),true);assert.equal(canTransition(S.POSITION_CONFIRMED,S.MONITORING),true);assert.equal(canTransition(S.EXIT_SUBMITTING,S.ROUND_TRIP_COMPLETED),true)})
test('rejects invalid transitions',()=>assert.throws(()=>assertTransition(S.CANDIDATE_SELECTED,S.ROUND_TRIP_COMPLETED),/paper_auto_invalid_transition/))
test('classifies terminal states',()=>{assert.equal(terminalStates.has(S.ROUND_TRIP_COMPLETED),true);assert.equal(terminalStates.has(S.FAILED_NEEDS_REVIEW),true);assert.equal(terminalStates.has(S.ENTER_UNKNOWN),false)})
