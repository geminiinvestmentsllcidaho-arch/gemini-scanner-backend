import assert from 'node:assert/strict';
import { buildOperatorApprovalDashboardPanel } from '../src/scanner/operator_approval_dashboard_panel.mjs';

const panel = buildOperatorApprovalDashboardPanel();

assert.equal(panel.version, 'operator_approval_dashboard_panel_v1');
assert.equal(panel.dashboardSafe, true);
assert.equal(panel.operatorSafe, true);
assert.equal(panel.safety.noAutoPatching, true);
assert.equal(panel.safety.noProductionEdits, true);
assert.equal(panel.safety.noBrokerExecution, true);
assert.equal(panel.safety.noOrderPlacement, true);
assert.equal(panel.safety.noOAuthUserConnection, true);
assert.ok(Array.isArray(panel.validationCommands));
assert.ok(panel.validationCommands.includes('npm run validate:all'));

console.log(JSON.stringify({
  ok: true,
  version: panel.version,
  mode: panel.mode,
  approvalRequired: panel.approvalRequired,
  approved: panel.approved,
  blocked: panel.blocked,
  risk: panel.risk,
  statusLabel: panel.statusLabel
}, null, 2));
