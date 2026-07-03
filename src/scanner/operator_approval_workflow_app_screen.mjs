import { buildOperatorApprovalWorkflow } from './operator_approval_workflow.mjs';

export const VERSION = 'operator_approval_workflow_app_screen_v1';

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

export function buildOperatorApprovalWorkflowAppScreen(input = {}) {
  const workflow = object(input.workflow).version
    ? object(input.workflow)
    : buildOperatorApprovalWorkflow(input.source || input, input.options || {});
  const safety = object(workflow.safety);
  const instructions = object(workflow.operatorInstructions);
  const preview = object(workflow.patchPlanPreview);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: '/app/operator-approval-workflow',
    title: 'Operator Approval Workflow',
    subtitle: 'Read-only operator approval workflow app screen.',
    workflowVersion: workflow.version || 'unknown',
    mode: workflow.mode || 'monitor_only',
    approvalStatus: workflow.approvalStatus || 'unknown',
    approvalRequired: Boolean(workflow.approvalRequired),
    approved: Boolean(workflow.approved),
    blocked: Boolean(workflow.blocked),
    blockedReason: workflow.blockedReason || null,
    highestRisk: workflow.highestRisk || preview.highestRisk || 'unknown',
    dashboardSafe: workflow.dashboardSafe !== false,
    operatorSafe: workflow.operatorSafe !== false,
    safety: {
      readOnly: true,
      monitorOnly: true,
      autoPatching: safety.autoPatching === true,
      productionEdits: safety.productionEdits === true,
      brokerExecution: safety.brokerExecution === true,
      orderPlacement: safety.orderPlacement === true,
      oauthConnection: safety.oauthConnection === true
    },
    patchPlanPreview: {
      changeDetected: Boolean(preview.changeDetected),
      patchCount: Number.isFinite(preview.patchCount) ? preview.patchCount : 0,
      patchLabels: array(preview.patchLabels)
    },
    operatorInstructions: {
      operatorState: instructions.operatorState || 'review',
      headline: instructions.headline || '',
      nextAction: instructions.nextAction || '',
      approvalCommandTemplate: instructions.approvalCommandTemplate || null,
      validationCommands: array(instructions.validationCommands),
      displayWarnings: array(instructions.displayWarnings),
      riskNotice: instructions.riskNotice || '',
      changeNotice: instructions.changeNotice || ''
    },
    links: {
      dashboardHref: '/app/operator-approval-dashboard',
      diagnosticHref: '/diagnostics/operator-approval-workflow',
      dashboardDiagnosticHref: '/diagnostics/operator-approval-dashboard-panel'
    }
  };
}

export function renderOperatorApprovalWorkflowAppScreenHtml(screen = {}) {
  const safety = object(screen.safety);
  const preview = object(screen.patchPlanPreview);
  const instructions = object(screen.operatorInstructions);
  const links = object(screen.links);
  const labels = array(preview.patchLabels);
  const validations = array(instructions.validationCommands);
  const warnings = array(instructions.displayWarnings);
  const statusClass = screen.blocked ? 'blocked' : screen.approved ? 'ok' : 'review';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(screen.title || 'Operator Approval Workflow')}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#0b1020;color:#e8eefc}
    main{max-width:980px;margin:0 auto;padding:24px}
    a{color:#9cc7ff}.card{border:1px solid #263451;border-radius:16px;padding:18px;margin:14px 0;background:#121a2d}
    .badge{display:inline-block;border-radius:999px;padding:6px 10px;font-weight:750}.blocked{background:#3a1720;color:#ffb4c4}.ok{background:#12351f;color:#a8f5bf}.review{background:#2f2a13;color:#ffe28a}
    code{background:#08111f;border:1px solid #263451;border-radius:8px;padding:2px 6px}.muted{color:#aab7d4}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}ul{padding-left:22px}
  </style>
</head>
<body><main>
  <p><a href="/app">Back to App Navigation</a></p>
  <h1>${esc(screen.title || 'Operator Approval Workflow')}</h1>
  <p class="muted">${esc(screen.subtitle || 'Read-only operator approval workflow app screen.')}</p>
  <section class="card">
    <span class="badge ${statusClass}">${esc(screen.approvalStatus || 'unknown')}</span>
    <div class="grid">
      <p><strong>Mode</strong><br>${esc(screen.mode || 'monitor_only')}</p>
      <p><strong>Highest risk</strong><br>${esc(screen.highestRisk || 'unknown')}</p>
      <p><strong>Approval required</strong><br>${esc(screen.approvalRequired ? 'true' : 'false')}</p>
      <p><strong>Approved</strong><br>${esc(screen.approved ? 'true' : 'false')}</p>
      <p><strong>Blocked</strong><br>${esc(screen.blocked ? 'true' : 'false')}</p>
      <p><strong>Blocked reason</strong><br>${esc(screen.blockedReason || 'none')}</p>
    </div>
  </section>
  <section class="card"><h2>Safety Locks</h2><ul>
    <li>Read only: ${esc(safety.readOnly ? 'true' : 'false')}</li>
    <li>Monitor only: ${esc(safety.monitorOnly ? 'true' : 'false')}</li>
    <li>Auto patching enabled: ${esc(safety.autoPatching ? 'true' : 'false')}</li>
    <li>Production edits enabled: ${esc(safety.productionEdits ? 'true' : 'false')}</li>
    <li>Broker execution enabled: ${esc(safety.brokerExecution ? 'true' : 'false')}</li>
    <li>Order placement enabled: ${esc(safety.orderPlacement ? 'true' : 'false')}</li>
    <li>OAuth user connection enabled: ${esc(safety.oauthConnection ? 'true' : 'false')}</li>
  </ul></section>
  <section class="card"><h2>Patch Plan Preview</h2>
    <p><strong>Change detected</strong><br>${esc(preview.changeDetected ? 'true' : 'false')}</p>
    <p><strong>Patch count</strong><br>${esc(preview.patchCount ?? 0)}</p>
    ${labels.length ? `<ul>${labels.map((label) => `<li>${esc(label)}</li>`).join('')}</ul>` : '<p class="muted">No patch labels reported.</p>'}
  </section>
  <section class="card"><h2>Operator Instructions</h2>
    <p><strong>State</strong><br>${esc(instructions.operatorState || 'review')}</p>
    <p><strong>Headline</strong><br>${esc(instructions.headline || '')}</p>
    <p><strong>Next action</strong><br>${esc(instructions.nextAction || '')}</p>
    ${instructions.approvalCommandTemplate ? `<p><strong>Approval command template</strong><br><code>${esc(instructions.approvalCommandTemplate)}</code></p>` : '<p class="muted">No approval command template shown.</p>'}
    ${warnings.length ? `<h3>Warnings</h3><ul>${warnings.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
  </section>
  <section class="card"><h2>Validation Commands</h2>
    ${validations.length ? `<ul>${validations.map((cmd) => `<li><code>${esc(cmd)}</code></li>`).join('')}</ul>` : '<p class="muted">No validation commands reported.</p>'}
  </section>
  <section class="card"><h2>Diagnostics</h2>
    <p><a href="${esc(links.dashboardHref || '/app/operator-approval-dashboard')}">Operator approval dashboard app screen</a></p>
    <p><a href="${esc(links.diagnosticHref || '/diagnostics/operator-approval-workflow')}">JSON approval workflow</a></p>
    <p><a href="${esc(links.dashboardDiagnosticHref || '/diagnostics/operator-approval-dashboard-panel')}">JSON dashboard panel</a></p>
  </section>
</main></body></html>`;
}

export default buildOperatorApprovalWorkflowAppScreen;
