import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  evaluateApiPatchApproval,
  hashApiPatchPlan,
  writeApiPatchApprovalRecord
} from '../src/scanner/api_patch_approval_gate.mjs';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'api-patch-approval-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('blocks approval-required patch plan when no local approval record exists', () => {
  const dir = tempDir();
  const planPath = path.join(dir, 'plan.json');
  const approvalPath = path.join(dir, 'approval.json');

  writeJson(planPath, {
    changeDetected: true,
    highestRisk: 'high',
    userApprovalRequired: true
  });

  const gate = evaluateApiPatchApproval({ planPath, approvalPath });

  assert.equal(gate.approvalRequired, true);
  assert.equal(gate.approved, false);
  assert.equal(gate.blocked, true);
  assert.equal(gate.state, 'blocked_unapproved');
  assert.deepEqual(gate.approvalIssues, ['API_PATCH_APPROVAL_MISSING']);
});

test('unblocks only when approval record matches the exact plan hash', () => {
  const dir = tempDir();
  const planPath = path.join(dir, 'plan.json');
  const approvalPath = path.join(dir, 'approval.json');
  const plan = {
    changeDetected: true,
    highestRisk: 'high',
    userApprovalRequired: true,
    affectedApiAreas: ['market_data']
  };

  writeJson(planPath, plan);
  const record = writeApiPatchApprovalRecord({
    planPath,
    approvalPath,
    approvedBy: 'Borac',
    reason: 'local approval gate test'
  });

  const gate = evaluateApiPatchApproval({ planPath, approvalPath });

  assert.equal(record.planHash, hashApiPatchPlan(plan));
  assert.equal(gate.approvalRequired, true);
  assert.equal(gate.approved, true);
  assert.equal(gate.blocked, false);
  assert.equal(gate.state, 'approved');
  assert.equal(gate.approvedBy, 'Borac');
  assert.equal(gate.approvalMatchesPlan, true);
});

test('blocks when approval record exists but plan changes afterward', () => {
  const dir = tempDir();
  const planPath = path.join(dir, 'plan.json');
  const approvalPath = path.join(dir, 'approval.json');

  writeJson(planPath, {
    changeDetected: true,
    highestRisk: 'high',
    userApprovalRequired: true,
    affectedApiAreas: ['market_data']
  });

  writeApiPatchApprovalRecord({
    planPath,
    approvalPath,
    approvedBy: 'Borac',
    reason: 'approval before plan changed'
  });

  writeJson(planPath, {
    changeDetected: true,
    highestRisk: 'critical',
    userApprovalRequired: true,
    affectedApiAreas: ['market_data', 'trading_api_safety']
  });

  const gate = evaluateApiPatchApproval({ planPath, approvalPath });

  assert.equal(gate.approvalRequired, true);
  assert.equal(gate.approved, false);
  assert.equal(gate.blocked, true);
  assert.equal(gate.state, 'blocked_approval_mismatch');
  assert.equal(gate.approvalMatchesPlan, false);
  assert.ok(gate.approvalIssues.includes('API_PATCH_APPROVAL_PLAN_HASH_MISMATCH'));
});

test('does not block when the patch plan explicitly requires no approval', () => {
  const dir = tempDir();
  const planPath = path.join(dir, 'plan.json');
  const approvalPath = path.join(dir, 'approval.json');

  writeJson(planPath, {
    changeDetected: false,
    highestRisk: 'low',
    userApprovalRequired: false
  });

  const gate = evaluateApiPatchApproval({ planPath, approvalPath });

  assert.equal(gate.approvalRequired, false);
  assert.equal(gate.approved, true);
  assert.equal(gate.blocked, false);
  assert.equal(gate.state, 'not_required');
});

test('blocks when the patch plan file is missing', () => {
  const dir = tempDir();
  const planPath = path.join(dir, 'missing-plan.json');
  const approvalPath = path.join(dir, 'approval.json');

  const gate = evaluateApiPatchApproval({ planPath, approvalPath });

  assert.equal(gate.approvalRequired, true);
  assert.equal(gate.approved, false);
  assert.equal(gate.blocked, true);
  assert.equal(gate.state, 'blocked_missing_plan');
  assert.deepEqual(gate.approvalIssues, ['API_PATCH_PLAN_MISSING']);
});
