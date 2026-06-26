import { buildOperatorApprovalWorkflow } from './operator_approval_workflow.mjs';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function buildOperatorApprovalDashboardPanel(input = {}) {
  const workflow = input.workflow || buildOperatorApprovalWorkflow(input);
  const approval = safeObject(workflow.approval);
  const safety = safeObject(workflow.safety);
  const instructions = safeArray(workflow.operatorInstructions);
  const preview = safeObject(workflow.patchPlanPreview);

  const blocked = Boolean(workflow.blocked);
  const approved = Boolean(workflow.approved);
  const approvalRequired = Boolean(workflow.approvalRequired);

  const risk = workflow.highestRisk || preview.highestRisk || 'unknown';

  const statusLabel = approved
    ? 'APPROVED_MONITOR_ONLY'
    : blocked
      ? 'BLOCKED_APPROVAL_REQUIRED'
      : approvalRequired
        ? 'WAITING_FOR_APPROVAL'
        : 'MONITOR_ONLY';

  const riskWarning = risk === 'high' || risk === 'critical'
    ? 'High-risk patch plan detected. Manual operator review is required. No patch execution is allowed by this panel.'
    : 'Manual operator review is required before any future patch execution workflow can be considered.';

  const validationCommands = [
    'npm run watch:alpaca-api',
    'npm run plan:api-patch',
    'npm run approve:api-patch -- --by=Borac --reason="approved reason"',
    'npm run validate:api-patch-approval',
    'npm run validate:operator-approval-workflow',
    'npm run validate:api-patch-dashboard',
    'npm run validate:alpaca-api-watch',
    'npm run validate:alpaca-audit',
    'npm run validate:trading-safety',
    'npm run validate:connect-safety',
    'npm run alerts:scanner',
    'npm run validate:all'
  ];

  return {
    version: 'operator_approval_dashboard_panel_v1',
    dashboardSafe: true,
    operatorSafe: true,
    mode: workflow.mode || 'monitor_only',
    statusLabel,
    approvalRequired,
    approved,
    blocked,
    blockedReason: workflow.blockedReason || null,
    risk,
    riskWarning,
    approval: {
      status: workflow.approvalStatus || approval.status || statusLabel,
      approvedBy: workflow.approvedBy || approval.approvedBy || null,
      approvedAt: workflow.approvedAt || approval.approvedAt || null
    },
    patchPlanPreview: preview,
    operatorInstructions: instructions.length
      ? instructions
      : [
          'Review the blocked API patch plan.',
          'Confirm risk level and safety status.',
          'Run validation commands manually.',
          'Record explicit local approval only if appropriate.',
          'Do not execute production patches from this dashboard.'
        ],
    validationCommands,
    safety: {
      ...safety,
      noAutoPatching: true,
      noProductionEdits: true,
      noBrokerExecution: true,
      noOrderPlacement: true,
      noOAuthUserConnection: true,
      monitorOnly: true
    }
  };
}

export default buildOperatorApprovalDashboardPanel;
