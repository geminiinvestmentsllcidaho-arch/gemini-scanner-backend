import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOperatorApprovalDashboardPanel } from '../src/scanner/operator_approval_dashboard_panel.mjs';

test('operator approval dashboard panel is monitor-only and safe', () => {
  const panel = buildOperatorApprovalDashboardPanel({
    workflow: {
      mode: 'monitor_only',
      dashboardSafe: true,
      operatorSafe: true,
      approvalRequired: true,
      approved: false,
      blocked: true,
      highestRisk: 'high',
      blockedReason: 'explicit_local_approval_required',
      approvalStatus: 'blocked',
      patchPlanPreview: {
        changeDetected: true,
        highestRisk: 'high'
      },
      operatorInstructions: ['review manually'],
      safety: {
        monitorOnly: true
      }
    }
  });

  assert.equal(panel.version, 'operator_approval_dashboard_panel_v1');
  assert.equal(panel.dashboardSafe, true);
  assert.equal(panel.operatorSafe, true);
  assert.equal(panel.mode, 'monitor_only');
  assert.equal(panel.approvalRequired, true);
  assert.equal(panel.approved, false);
  assert.equal(panel.blocked, true);
  assert.equal(panel.risk, 'high');
  assert.equal(panel.blockedReason, 'explicit_local_approval_required');
  assert.equal(panel.statusLabel, 'BLOCKED_APPROVAL_REQUIRED');
  assert.match(panel.riskWarning, /High-risk patch plan detected/);
  assert.equal(panel.safety.noAutoPatching, true);
  assert.equal(panel.safety.noProductionEdits, true);
  assert.equal(panel.safety.noBrokerExecution, true);
  assert.equal(panel.safety.noOrderPlacement, true);
  assert.equal(panel.safety.noOAuthUserConnection, true);
  assert.ok(panel.validationCommands.includes('npm run validate:all'));
});

test('operator approval dashboard panel preserves approval metadata', () => {
  const panel = buildOperatorApprovalDashboardPanel({
    workflow: {
      mode: 'monitor_only',
      approvalRequired: true,
      approved: true,
      blocked: false,
      highestRisk: 'medium',
      approvalStatus: 'approved',
      approvedBy: 'Borac',
      approvedAt: '2026-06-26T00:00:00.000Z',
      patchPlanPreview: {},
      operatorInstructions: [],
      safety: {}
    }
  });

  assert.equal(panel.statusLabel, 'APPROVED_MONITOR_ONLY');
  assert.equal(panel.approval.status, 'approved');
  assert.equal(panel.approval.approvedBy, 'Borac');
  assert.equal(panel.approval.approvedAt, '2026-06-26T00:00:00.000Z');
  assert.equal(panel.safety.monitorOnly, true);
});
