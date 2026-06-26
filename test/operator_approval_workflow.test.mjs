import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOperatorApprovalWorkflow } from '../src/scanner/operator_approval_workflow.mjs'

test('blocks unapproved detected patch plans with explicit local approval instructions', () => {
  const workflow = buildOperatorApprovalWorkflow({
    approvalStatus: 'blocked_unapproved',
    approvalRequired: true,
    approved: false,
    blocked: true,
    changeDetected: true,
    highestRisk: 'high',
    patches: [{ label: 'orders_request_schema' }]
  }, { now: new Date('2026-06-26T12:00:00.000Z') })

  assert.equal(workflow.ok, true)
  assert.equal(workflow.version, 'operator_approval_workflow_v1')
  assert.equal(workflow.mode, 'monitor_only')
  assert.equal(workflow.dashboardSafe, true)
  assert.equal(workflow.operatorSafe, true)
  assert.equal(workflow.blocked, true)
  assert.equal(workflow.approved, false)
  assert.equal(workflow.blockedReason, 'explicit_local_approval_required')
  assert.equal(workflow.operatorInstructions.operatorState, 'blocked')
  assert.match(workflow.operatorInstructions.approvalCommandTemplate, /approve:api-patch/)
  assert.equal(workflow.safety.autoPatching, false)
  assert.equal(workflow.safety.productionEdits, false)
  assert.equal(workflow.safety.brokerExecution, false)
  assert.equal(workflow.safety.orderPlacement, false)
  assert.equal(workflow.safety.oauthConnection, false)
})

test('keeps approval separate from patch execution when approved', () => {
  const workflow = buildOperatorApprovalWorkflow({
    approvalStatus: 'approved',
    approvalRequired: true,
    approved: true,
    approvedBy: 'Borac',
    approvedAt: '2026-06-26T12:05:00.000Z',
    blocked: false,
    changeDetected: true,
    highestRisk: 'medium',
    patches: [{ objectLabel: 'market_data_endpoint' }]
  }, { now: new Date('2026-06-26T12:10:00.000Z') })

  assert.equal(workflow.blocked, false)
  assert.equal(workflow.approved, true)
  assert.equal(workflow.approvedBy, 'Borac')
  assert.equal(workflow.operatorInstructions.operatorState, 'approved')
  assert.equal(workflow.operatorInstructions.approvalCommandTemplate, null)
  assert.equal(workflow.operatorInstructions.displayWarnings.some((line) => /does not execute patches/i.test(line)), true)
})

test('creates stable preview labels from patch objects without executing anything', () => {
  const workflow = buildOperatorApprovalWorkflow({
    approvalGate: {
      approvalStatus: 'blocked_unapproved',
      approvalRequired: true,
      approved: false,
      blocked: true
    },
    patchPlan: {
      changeDetected: true,
      highestRisk: 'high',
      patches: [
        { endpoint: '/v2/orders' },
        { path: '/v2/account' }
      ]
    }
  }, { now: new Date('2026-06-26T12:15:00.000Z') })

  assert.deepEqual(workflow.patchPlanPreview.patchLabels, ['/v2/orders', '/v2/account'])
  assert.equal(workflow.patchPlanPreview.patchCount, 2)
  assert.equal(workflow.safety.autoPatching, false)
})
