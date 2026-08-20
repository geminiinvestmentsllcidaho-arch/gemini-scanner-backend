import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPaperAutoExecutionSessionValidationReport } from '../src/scanner/paper_auto_execution_session_validation_report.mjs'

const base = {
  scannerHealth:{ok:true,status:'ok'},
  marketDataFresh:true,
  continuity:{enabled:true,lastStatus:'NO_ELIGIBLE_CANDIDATE',lastSnapshotFresh:true,lastSnapshotObservedAt:'2026-08-20T14:30:00.000Z',lastSnapshotCandidateCount:8,lastEligibleCandidateCount:0,lastEligibleCandidateSymbol:null},
  enter:{enabled:true,lastStatus:'CONTINUITY_ENTER_NOT_REQUIRED'},
  scale:{enabled:true,lastStatus:'SCALE_NOT_REQUIRED'},
  exit:{enabled:true,running:true,lastStatus:'MONITORING'},
  degradedBroker:{degraded:false},
  readiness:{status:'READY',infrastructureReady:true,blockers:[]},
  assurance:{report:{healthy:true},incident:null},
}

test('Module 13 session report accepts legitimate no-trade market session as validated evidence',()=>{
  const report=buildPaperAutoExecutionSessionValidationReport({
    ...base,
    entryValidation:{status:'NO_ELIGIBLE_ENTRY',correlationId:'entry:no-trade',noTrade:{candidatesReviewed:8,eligibleCandidates:0,orderSubmitted:false}},
  },{now:'2026-08-20T14:31:00.000Z'})
  assert.equal(report.status,'VALIDATED')
  assert.equal(report.healthy,true)
  assert.equal(report.eligibleEntryOutcome.status,'NO_ELIGIBLE_ENTRY')
  assert.equal(report.eligibleEntryOutcome.orderSubmitted,false)
  assert.equal(report.marketData.candidateCount,8)
  assert.deepEqual(report.blockers,[])
  assert.equal(report.safety.orderPlacementAllowed,false)
  assert.equal(report.safety.liveTradingAllowed,false)
})

test('Module 13 session report accepts correlated completed PAPER entry and reconciliation',()=>{
  const report=buildPaperAutoExecutionSessionValidationReport({...base,
    continuity:{...base.continuity,lastStatus:'FRESH_CANDIDATE_LIFECYCLE_CREATED',lastEligibleCandidateCount:1,lastEligibleCandidateSymbol:'M13'},
    enter:{enabled:true,lastStatus:'CONTINUITY_ENTER_MONITORING_CONFIRMED',lastReconciliation:{status:'RECONCILED_STATE_UPDATED'}},
    entryValidation:{status:'ENTRY_COMPLETED',correlationId:'entry:abc',allocationPercent:10,proposedQuantity:4,executedQuantity:4,lastEntry:{lifecycleId:'life13',lifecycleState:'MONITORING',brokerOrderId:'paper13',filledQuantity:4,averageFillPrice:5.25,reconciliationStatus:'RECONCILED_STATE_UPDATED',brokerPositionIdentity:'M13:4'}},
    lifecycle:{lifecycleId:'life13',state:'MONITORING',filledQuantity:4,averageFillPrice:5.25,brokerPositionIdentity:'M13:4'},
  },{now:'2026-08-20T14:31:00.000Z'})
  assert.equal(report.status,'VALIDATED')
  assert.equal(report.eligibleEntryOutcome.status,'ENTRY_COMPLETED')
  assert.equal(report.eligibleEntryOutcome.orderSubmitted,true)
  assert.equal(report.reconciliation.brokerOrderId,'paper13')
  assert.equal(report.reconciliation.lifecycleState,'MONITORING')
  assert.equal(report.reconciliation.filledQuantity,4)
})

test('Module 13 session report fails review when infrastructure, assurance, broker, or validation evidence is unhealthy',()=>{
  const report=buildPaperAutoExecutionSessionValidationReport({...base,
    scannerHealth:{ok:false,status:'degraded'},
    marketDataFresh:false,
    continuity:{...base.continuity,lastSnapshotFresh:false},
    degradedBroker:{degraded:true,reason:'ACCOUNT_READ_FAILED'},
    readiness:{status:'BLOCKED',infrastructureReady:false,blockers:['accountConnected']},
    assurance:{report:{healthy:false},incident:{open:true}},
    entryValidation:{status:'FAILED_NEEDS_REVIEW',lastCandidate:{blocker:'PAPER_ACCOUNT_SNAPSHOT_STALE'}},
  },{now:'2026-08-20T14:31:00.000Z'})
  assert.equal(report.status,'FAILED_NEEDS_REVIEW')
  assert.equal(report.healthy,false)
  assert.ok(report.blockers.includes('scanner_health_not_confirmed'))
  assert.ok(report.blockers.includes('market_data_freshness_not_confirmed'))
  assert.ok(report.blockers.includes('accountConnected'))
  assert.ok(report.blockers.includes('execution_assurance_not_healthy'))
  assert.ok(report.blockers.includes('ACCOUNT_READ_FAILED'))
  assert.ok(report.blockers.includes('PAPER_ACCOUNT_SNAPSHOT_STALE'))
  assert.equal(report.readOnly,true)
  assert.equal(report.safety.strategyMutationAllowed,false)
  assert.equal(report.safety.sizingMutationAllowed,false)
  assert.equal(report.safety.aiAuthorityMutationAllowed,false)
})


test('Module 13 recovered assurance incident wrapper is not reported as currently open',()=>{
  const report=buildPaperAutoExecutionSessionValidationReport({
    ...base,
    assurance:{
      report:{healthy:true},
      incident:{
        incident:{status:'recovered',open:false},
        persistence:{appended:true},
        delivery:{attempted:true,delivered:true},
      },
    },
    entryValidation:{status:'NO_ELIGIBLE_ENTRY',correlationId:'entry:recovered',noTrade:{candidatesReviewed:8,eligibleCandidates:0,orderSubmitted:false}},
  },{now:'2026-08-20T14:31:00.000Z'})
  assert.equal(report.status,'VALIDATED')
  assert.equal(report.execution.assurance.healthy,true)
  assert.equal(report.execution.assurance.incidentOpen,false)
})

test('Module 13 nested active assurance incident is reported as currently open',()=>{
  const report=buildPaperAutoExecutionSessionValidationReport({
    ...base,
    assurance:{
      report:{healthy:false},
      incident:{incident:{status:'open',open:true}},
    },
    entryValidation:{status:'NO_ELIGIBLE_ENTRY',correlationId:'entry:open',noTrade:{candidatesReviewed:8,eligibleCandidates:0,orderSubmitted:false}},
  },{now:'2026-08-20T14:31:00.000Z'})
  assert.equal(report.status,'FAILED_NEEDS_REVIEW')
  assert.equal(report.execution.assurance.healthy,false)
  assert.equal(report.execution.assurance.incidentOpen,true)
})

test('Module 13 explicit stale market-data authority cannot be overridden by a fresh continuity snapshot',()=>{
  const report=buildPaperAutoExecutionSessionValidationReport({
    ...base,
    marketDataFresh:false,
    continuity:{...base.continuity,lastSnapshotFresh:true},
    entryValidation:{status:'NO_ELIGIBLE_ENTRY',correlationId:'entry:stale-authority',noTrade:{candidatesReviewed:8,eligibleCandidates:0,orderSubmitted:false}},
  },{now:'2026-08-20T14:31:00.000Z'})
  assert.equal(report.marketData.fresh,false)
  assert.equal(report.status,'FAILED_NEEDS_REVIEW')
  assert.ok(report.blockers.includes('market_data_freshness_not_confirmed'))
})
