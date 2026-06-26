import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_PATCH_PLAN_PATH = path.resolve(process.cwd(), 'runs/alpaca_api_patch_plan.json')

function asBool(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function asString(value, fallback = 'unknown') {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function countPatchItems(source = {}) {
  const candidates = [
    source.patches,
    source.patchPlan?.patches,
    source.plan?.patches,
    source.recommendedPatches,
    source.recommendations,
    source.items,
    source.changes,
    source.detectedChanges,
    source.plan?.changes,
    source.patchPlan?.changes
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.length
  }

  const numericCandidates = [
    source.patchCount,
    source.changeCount,
    source.detectedChangeCount,
    source.plan?.patchCount,
    source.patchPlan?.patchCount,
    source.summary?.patchCount,
    source.summary?.changeCount
  ]

  for (const candidate of numericCandidates) {
    if (Number.isFinite(candidate)) return candidate
  }

  return 0
}

function extractPatchLabels(source = {}) {
  const candidates = [
    source.patches,
    source.patchPlan?.patches,
    source.plan?.patches,
    source.recommendedPatches,
    source.recommendations,
    source.items,
    source.changes,
    source.detectedChanges
  ]

  const labels = []

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue

    for (const item of candidate.slice(0, 10)) {
      if (typeof item === 'string') {
        labels.push(item)
        continue
      }

      if (item && typeof item === 'object') {
        labels.push(
          item.label ||
          item.name ||
          item.title ||
          item.id ||
          item.objectLabel ||
          item.object ||
          item.endpoint ||
          item.path ||
          'unlabeled_patch_item'
        )
      }
    }

    if (labels.length) break
  }

  return labels.map((label) => String(label)).slice(0, 10)
}

function extractApproval(source = {}) {
  const gate = source.approvalGate && typeof source.approvalGate === 'object'
    ? source.approvalGate
    : {}

  const approvalStatus = asString(
    source.approvalStatus ??
    gate.approvalStatus ??
    gate.status,
    'unknown'
  )

  const approvalRequired = asBool(
    source.approvalRequired ??
    gate.approvalRequired,
    true
  )

  const approved = asBool(
    source.approved ??
    gate.approved,
    false
  )

  const blocked = asBool(
    source.blocked ??
    gate.blocked,
    approvalRequired && !approved
  )

  return {
    approvalStatus,
    approvalRequired,
    approved,
    approvedBy: source.approvedBy ?? gate.approvedBy ?? null,
    approvedAt: source.approvedAt ?? gate.approvedAt ?? null,
    blocked
  }
}

function extractSafety(source = {}) {
  const inherited = source.safety && typeof source.safety === 'object'
    ? source.safety
    : {}

  return {
    mode: 'monitor_only',
    autoPatching: false,
    productionEdits: false,
    brokerExecution: false,
    orderPlacement: false,
    oauthConnection: false,
    inherited
  }
}

function buildInstructions({ approval, highestRisk, changeDetected }) {
  if (approval.blocked) {
    return {
      operatorState: 'blocked',
      headline: 'Patch plan is blocked until explicit local approval is recorded.',
      nextAction: 'Review the dashboard plan, confirm the risk, then record approval locally only if the operator accepts it.',
      approvalCommandTemplate: 'npm run approve:api-patch -- --by=Borac --reason="approved reason"',
      validationCommands: [
        'npm run validate:api-patch-approval',
        'npm run validate:api-patch-dashboard',
        'npm run validate:all'
      ],
      displayWarnings: [
        'Monitor-only workflow.',
        'Does not execute patches.',
        'Does not edit production files.',
        'Does not place broker orders.',
        'Does not connect OAuth/user accounts.'
      ],
      riskNotice: highestRisk === 'high'
        ? 'Highest detected risk is high; approval must remain explicit and auditable.'
        : 'Approval remains explicit and auditable before any future patch workflow proceeds.',
      changeNotice: changeDetected
        ? 'A change was detected and is waiting for operator review.'
        : 'No active change was detected, but approval workflow remains visible.'
    }
  }

  if (approval.approved) {
    return {
      operatorState: 'approved',
      headline: 'Patch plan has a local approval record.',
      nextAction: 'Run validation before any separate patch execution workflow is considered.',
      approvalCommandTemplate: null,
      validationCommands: [
        'npm run validate:api-patch-approval',
        'npm run validate:api-patch-dashboard',
        'npm run validate:all'
      ],
      displayWarnings: [
        'Approval does not execute patches.',
        'Approval does not edit production files.',
        'Approval does not place broker orders.',
        'Approval only records operator intent.'
      ],
      riskNotice: 'Approval is recorded, but execution remains separate.',
      changeNotice: changeDetected
        ? 'Detected changes remain visible for review.'
        : 'No active detected changes are currently reported.'
    }
  }

  return {
    operatorState: 'review',
    headline: 'Patch plan is available for operator review.',
    nextAction: 'Review patch plan status and run validation commands.',
    approvalCommandTemplate: 'npm run approve:api-patch -- --by=Borac --reason="approved reason"',
    validationCommands: [
      'npm run validate:api-patch-approval',
      'npm run validate:api-patch-dashboard',
      'npm run validate:all'
    ],
    displayWarnings: [
      'Monitor-only workflow.',
      'No patches are executed by this workflow.'
    ],
    riskNotice: 'Risk state is available for operator review.',
    changeNotice: changeDetected
      ? 'A change was detected.'
      : 'No active change was detected.'
  }
}

export function buildOperatorApprovalWorkflow(source = {}, options = {}) {
  const now = options.now ?? new Date()
  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString()

  const approval = extractApproval(source)
  const highestRisk = asString(
    source.highestRisk ??
    source.patchPlan?.highestRisk ??
    source.plan?.highestRisk ??
    source.summary?.highestRisk,
    'unknown'
  )

  const changeDetected = asBool(
    source.changeDetected ??
    source.patchPlan?.changeDetected ??
    source.plan?.changeDetected ??
    source.summary?.changeDetected,
    false
  )

  const patchCount = countPatchItems(source)
  const patchLabels = extractPatchLabels(source)
  const safety = extractSafety(source)
  const operatorInstructions = buildInstructions({ approval, highestRisk, changeDetected })

  return {
    ok: true,
    version: 'operator_approval_workflow_v1',
    generatedAt,
    mode: 'monitor_only',
    dashboardSafe: true,
    operatorSafe: true,
    approval,
    approvalStatus: approval.approvalStatus,
    approvalRequired: approval.approvalRequired,
    approved: approval.approved,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    blocked: approval.blocked,
    changeDetected,
    highestRisk,
    patchPlanPreview: {
      patchCount,
      patchLabels,
      hasPreviewItems: patchLabels.length > 0
    },
    operatorInstructions,
    safety,
    blockedReason: approval.blocked
      ? 'explicit_local_approval_required'
      : null
  }
}

export async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

export async function loadOperatorApprovalWorkflow(options = {}) {
  const now = options.now ?? new Date()
  const planPath = options.planPath ?? DEFAULT_PATCH_PLAN_PATH

  let source = null

  try {
    const dashboardModule = await import('./api_patch_plan_dashboard.mjs')
    const loader =
      dashboardModule.getApiPatchPlanDashboardData ||
      dashboardModule.getApiPatchPlanDashboard ||
      dashboardModule.buildApiPatchPlanDashboard ||
      dashboardModule.loadApiPatchPlanDashboard ||
      dashboardModule.default

    if (typeof loader === 'function') {
      source = await loader(options)
    }
  } catch {
    source = null
  }

  if (!source) {
    source = await readJsonIfExists(planPath)
  }

  if (!source) {
    source = {
      approvalStatus: 'missing_patch_plan',
      approvalRequired: true,
      approved: false,
      blocked: true,
      changeDetected: false,
      highestRisk: 'unknown'
    }
  }

  return buildOperatorApprovalWorkflow(source, { now })
}

export default {
  buildOperatorApprovalWorkflow,
  loadOperatorApprovalWorkflow,
  readJsonIfExists
}
