import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOperatorApprovalWorkflowAppScreen,
  renderOperatorApprovalWorkflowAppScreenHtml
} from '../src/scanner/operator_approval_workflow_app_screen.mjs';

test('builds read-only operator approval workflow app screen', () => {
  const screen = buildOperatorApprovalWorkflowAppScreen({
    workflow: {
      version: 'operator_approval_workflow_v1',
      mode: 'monitor_only',
      approvalStatus: 'blocked_unapproved',
      approvalRequired: true,
      approved: false,
      blocked: true,
      blockedReason: 'explicit_local_approval_required',
      highestRisk: 'high',
      dashboardSafe: true,
      operatorSafe: true,
      safety: {
        autoPatching: false,
        productionEdits: false,
        brokerExecution: false,
        orderPlacement: false,
        oauthConnection: false
      },
      patchPlanPreview: {
        changeDetected: true,
        patchCount: 1,
        patchLabels: ['orders_request_schema']
      },
      operatorInstructions: {
        operatorState: 'blocked',
        headline: 'Patch plan is blocked.',
        nextAction: 'Review only.',
        approvalCommandTemplate: 'npm run approve:api-patch -- --by=Borac --reason="approved reason"',
        validationCommands: ['npm run validate:all'],
        displayWarnings: ['Does not execute patches.']
      }
    }
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, 'operator_approval_workflow_app_screen_v1');
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, '/app/operator-approval-workflow');
  assert.equal(screen.blocked, true);
  assert.equal(screen.safety.readOnly, true);
  assert.equal(screen.safety.monitorOnly, true);
  assert.equal(screen.safety.brokerExecution, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.links.diagnosticHref, '/diagnostics/operator-approval-workflow');
});

test('renders operator approval workflow html without mutation controls', () => {
  const screen = buildOperatorApprovalWorkflowAppScreen({
    workflow: {
      version: 'operator_approval_workflow_v1',
      mode: 'monitor_only',
      approvalStatus: 'blocked_unapproved',
      approvalRequired: true,
      approved: false,
      blocked: true,
      highestRisk: 'high',
      safety: {},
      patchPlanPreview: { patchLabels: ['orders_request_schema'] },
      operatorInstructions: { validationCommands: ['npm run validate:all'], displayWarnings: ['Does not execute patches.'] }
    }
  });
  const html = renderOperatorApprovalWorkflowAppScreenHtml(screen);

  assert.match(html, /Operator Approval Workflow/);
  assert.match(html, /blocked_unapproved/);
  assert.match(html, /Order placement enabled: false/);
  assert.match(html, /Does not execute patches/);
  assert.match(html, /\/diagnostics\/operator-approval-workflow/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
  assert.doesNotMatch(html, /\bmethod=["']/i);
});
