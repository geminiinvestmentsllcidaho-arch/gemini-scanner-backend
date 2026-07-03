import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOperatorApprovalDashboardAppScreen,
  renderOperatorApprovalDashboardAppScreenHtml
} from '../src/scanner/operator_approval_dashboard_app_screen.mjs';

test('builds read-only operator approval dashboard app screen', () => {
  const screen = buildOperatorApprovalDashboardAppScreen({
    panel: {
      version: 'operator_approval_dashboard_panel_v1',
      mode: 'monitor_only',
      approvalRequired: true,
      approved: false,
      blocked: true,
      risk: 'high',
      blockedReason: 'explicit_local_approval_required',
      statusLabel: 'BLOCKED_APPROVAL_REQUIRED',
      riskWarning: 'High-risk patch plan detected.',
      approval: {
        status: 'blocked',
        approvedBy: null,
        approvedAt: null
      },
      safety: {
        noAutoPatching: true,
        noProductionEdits: true,
        noBrokerExecution: true,
        noOrderPlacement: true,
        noOAuthUserConnection: true
      },
      validationCommands: ['npm run validate:all'],
      operatorInstructions: ['review manually']
    }
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, 'operator_approval_dashboard_app_screen_v1');
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, '/app/operator-approval-dashboard');
  assert.equal(screen.statusLabel, 'BLOCKED_APPROVAL_REQUIRED');
  assert.equal(screen.blocked, true);
  assert.equal(screen.approved, false);
  assert.equal(screen.safety.readOnly, true);
  assert.equal(screen.safety.monitorOnly, true);
  assert.equal(screen.safety.noBrokerExecution, true);
  assert.equal(screen.safety.noOrderPlacement, true);
  assert.equal(screen.links.diagnosticHref, '/diagnostics/operator-approval-dashboard-panel');
});

test('renders operator approval dashboard html without mutation controls', () => {
  const screen = buildOperatorApprovalDashboardAppScreen({
    panel: {
      version: 'operator_approval_dashboard_panel_v1',
      mode: 'monitor_only',
      approvalRequired: true,
      approved: false,
      blocked: true,
      risk: 'high',
      statusLabel: 'BLOCKED_APPROVAL_REQUIRED',
      safety: {},
      validationCommands: ['npm run validate:all'],
      operatorInstructions: []
    }
  });

  const html = renderOperatorApprovalDashboardAppScreenHtml(screen);

  assert.match(html, /Operator Approval Dashboard/);
  assert.match(html, /BLOCKED_APPROVAL_REQUIRED/);
  assert.match(html, /No broker execution/);
  assert.match(html, /No order placement/);
  assert.match(html, /\/diagnostics\/operator-approval-dashboard-panel/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
  assert.doesNotMatch(html, /\bmethod=["']/i);
});
