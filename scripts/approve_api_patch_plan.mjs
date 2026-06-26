#!/usr/bin/env node
import { writeApiPatchApprovalRecord } from '../src/scanner/api_patch_approval_gate.mjs';

function readArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const approvedBy = readArg('by') || process.env.GEMINI_APPROVED_BY;
const reason = readArg('reason') || process.env.GEMINI_APPROVAL_REASON || '';

if (!approvedBy) {
  console.error('STOP: explicit approval required. Usage: npm run approve:api-patch -- --by=Borac --reason="approved reason"');
  process.exit(1);
}

const record = writeApiPatchApprovalRecord({ approvedBy, reason });
console.log(JSON.stringify({
  ok: true,
  message: 'api patch approval recorded locally; no patch executed',
  approvalType: record.approvalType,
  approvedBy: record.approvedBy,
  approvedAt: record.approvedAt,
  planHash: record.planHash,
  monitorOnly: record.monitorOnly,
  safety: record.safety
}, null, 2));
