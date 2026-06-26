#!/usr/bin/env node
import { evaluateApiPatchApproval } from '../src/scanner/api_patch_approval_gate.mjs';

const gate = evaluateApiPatchApproval();

if (gate.approvalRequired && gate.approved && gate.blocked) {
  console.error(JSON.stringify({ ok: false, reason: 'approval gate cannot be approved and blocked at the same time', gate }, null, 2));
  process.exit(1);
}

if (gate.approvalRequired && !gate.approved && !gate.blocked) {
  console.error(JSON.stringify({ ok: false, reason: 'approval-required plan must be blocked until approved', gate }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  approvalRequired: gate.approvalRequired,
  approved: gate.approved,
  blocked: gate.blocked,
  state: gate.state,
  approvedBy: gate.approvedBy,
  approvedAt: gate.approvedAt,
  approvalIssues: gate.approvalIssues,
  monitorOnly: true
}, null, 2));
