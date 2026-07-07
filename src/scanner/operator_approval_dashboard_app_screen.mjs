import { buildOperatorApprovalDashboardPanel } from './operator_approval_dashboard_panel.mjs';

export const VERSION = 'operator_approval_dashboard_app_screen_v1';

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildOperatorApprovalDashboardAppScreen(input = {}) {
  const panel = object(input.panel).version ? object(input.panel) : buildOperatorApprovalDashboardPanel(input);
  const safety = object(panel.safety);
  const approval = object(panel.approval);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: '/app/operator-approval-dashboard',
    title: 'Operator Approval Dashboard',
    subtitle: 'Read-only operator approval workflow app screen.',
    statusLabel: panel.statusLabel || approval.status || 'UNKNOWN',
    mode: panel.mode || 'monitor_only',
    risk: panel.risk || 'unknown',
    approvalRequired: Boolean(panel.approvalRequired),
    approved: Boolean(panel.approved),
    blocked: Boolean(panel.blocked),
    blockedReason: panel.blockedReason || null,
    riskWarning: panel.riskWarning || null,
    approval: {
      status: approval.status || panel.approvalStatus || 'unknown',
      approvedBy: approval.approvedBy || null,
      approvedAt: approval.approvedAt || null
    },
    safety: {
      readOnly: true,
      monitorOnly: true,
      noAutoPatching: safety.noAutoPatching !== false,
      noProductionEdits: safety.noProductionEdits !== false,
      noBrokerExecution: safety.noBrokerExecution !== false,
      noOrderPlacement: safety.noOrderPlacement !== false,
      noOAuthUserConnection: safety.noOAuthUserConnection !== false
    },
    validationCommands: array(panel.validationCommands),
    operatorInstructions: array(panel.operatorInstructions),
    links: {
      diagnosticHref: '/diagnostics/operator-approval-dashboard-panel',
      workflowHref: '/diagnostics/operator-approval-workflow'
    }
  };
}

function statusClass(status) {
  const label = String(status || '').toLowerCase();
  if (label.includes('approved')) return 'ok';
  if (label.includes('blocked')) return 'blocked';
  return 'review';
}

export function renderOperatorApprovalDashboardAppScreenHtml(screen = {}) {
  const safety = object(screen.safety);
  const approval = object(screen.approval);
  const links = object(screen.links);
  const validation = array(screen.validationCommands);
  const instructions = array(screen.operatorInstructions);
  const cls = statusClass(screen.statusLabel);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(screen.title || 'Operator Approval Dashboard')}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#0b1020;color:#e8eefc}
    main{max-width:980px;margin:0 auto;padding:24px}
    a{color:#9cc7ff}
    .card{border:1px solid #263451;border-radius:16px;padding:18px;margin:14px 0;background:#121a2d}
    .badge{display:inline-block;border-radius:999px;padding:6px 10px;font-weight:750}
    .blocked{background:#3a1720;color:#ffb4c4}
    .ok{background:#12351f;color:#a8f5bf}
    .review{background:#2f2a13;color:#ffe28a}
    code{background:#08111f;border:1px solid #263451;border-radius:8px;padding:2px 6px}
    ul{padding-left:22px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .muted{color:#aab7d4}
  </style>
</head>
<body>
  <main>
    <p><a href="/app">Back to App Navigation</a></p>
    <h1>${esc(screen.title || 'Operator Approval Dashboard')}</h1>
    <p class="muted">${esc(screen.subtitle || 'Read-only operator approval workflow app screen.')}</p>

    <section class="card">
      <span class="badge ${cls}">${esc(screen.statusLabel || 'UNKNOWN')}</span>
      <div class="grid">
        <p><strong>Mode</strong><br>${esc(screen.mode || 'monitor_only')}</p>
        <p><strong>Risk</strong><br>${esc(screen.risk || 'unknown')}</p>
        <p><strong>Approval required</strong><br>${esc(screen.approvalRequired ? 'true' : 'false')}</p>
        <p><strong>Approved</strong><br>${esc(screen.approved ? 'true' : 'false')}</p>
        <p><strong>Blocked</strong><br>${esc(screen.blocked ? 'true' : 'false')}</p>
        <p><strong>Blocked reason</strong><br>${esc(screen.blockedReason || 'none')}</p>
      </div>
      ${screen.riskWarning ? `<p><strong>Risk warning</strong><br>${esc(screen.riskWarning)}</p>` : ''}
    </section>

    <section class="card">
      <h2>Safety Locks</h2>
      <ul>
        <li>Read only: ${esc(safety.readOnly ? 'true' : 'false')}</li>
        <li>Monitor only: ${esc(safety.monitorOnly ? 'true' : 'false')}</li>
        <li>No auto patching: ${esc(safety.noAutoPatching ? 'true' : 'false')}</li>
        <li>No production edits: ${esc(safety.noProductionEdits ? 'true' : 'false')}</li>
        <li>No broker execution: ${esc(safety.noBrokerExecution ? 'true' : 'false')}</li>
        <li>No order placement: ${esc(safety.noOrderPlacement ? 'true' : 'false')}</li>
        <li>No OAuth user connection: ${esc(safety.noOAuthUserConnection ? 'true' : 'false')}</li>
      </ul>
    </section>

    <section class="card">
      <h2>Approval Metadata</h2>
      <p><strong>Status</strong><br>${esc(approval.status || 'unknown')}</p>
      <p><strong>Approved by</strong><br>${esc(approval.approvedBy || 'none')}</p>
      <p><strong>Approved at</strong><br>${esc(approval.approvedAt || 'none')}</p>
    </section>

    <section class="card">
      <h2>Validation Commands</h2>
      ${validation.length ? `<ul>${validation.map((cmd) => `<li><code>${esc(cmd)}</code></li>`).join('')}</ul>` : '<p class="muted">No validation commands reported.</p>'}
    </section>

    <section class="card">
      <h2>Operator Instructions</h2>
      ${instructions.length ? `<ul>${instructions.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="muted">No operator instructions reported.</p>'}
    </section>

    <section class="card">
      <h2>Diagnostics</h2>
      <p><a href="${esc(links.diagnosticHref || '/diagnostics/operator-approval-dashboard-panel')}">JSON dashboard panel</a></p>
      <p><a href="${esc(links.workflowHref || '/diagnostics/operator-approval-workflow')}">JSON approval workflow</a></p>
    </section>
  <section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main>
</body>
</html>`;
}

export default buildOperatorApprovalDashboardAppScreen;
