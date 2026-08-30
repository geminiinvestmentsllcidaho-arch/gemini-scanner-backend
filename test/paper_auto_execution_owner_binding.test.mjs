import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  VERSION,
  bootstrapPaperAutoExecutionOwnerBinding,
  readPaperAutoExecutionOwnerBinding,
} from '../src/scanner/paper_auto_execution_owner_binding.mjs'

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-owner-binding-'))
  return { dir, file: path.join(dir, 'owner.json') }
}

test('bootstraps exactly one eligible execution owner into private durable binding', () => {
  const { file } = tempFile()
  const result = bootstrapPaperAutoExecutionOwnerBinding({
    bindingPath: file,
    nowMs: Date.parse('2026-08-29T23:00:00Z'),
    accounts: [
      { id: 'owner-a', status: 'active', emailVerified: true, notificationPreferences: { exitEmailEnabled: true } },
      { id: 'other', status: 'active', emailVerified: true, notificationPreferences: { exitEmailEnabled: false } },
    ],
  })
  assert.equal(result.resolved, true)
  assert.equal(result.created, true)
  assert.equal(result.binding.accountId, 'owner-a')
  assert.equal(fs.statSync(file).mode & 0o777, 0o600)
  assert.deepEqual(readPaperAutoExecutionOwnerBinding({ bindingPath: file }).binding, {
    version: VERSION,
    accountId: 'owner-a',
    createdAt: '2026-08-29T23:00:00.000Z',
  })
})

test('existing durable owner binding does not shift when notification preferences later change', () => {
  const { file } = tempFile()
  bootstrapPaperAutoExecutionOwnerBinding({
    bindingPath: file,
    accounts: [{ id: 'owner-a', status: 'active', emailVerified: true, notificationPreferences: { exitEmailEnabled: true } }],
  })
  const result = bootstrapPaperAutoExecutionOwnerBinding({
    bindingPath: file,
    accounts: [{ id: 'owner-b', status: 'active', emailVerified: true, notificationPreferences: { exitEmailEnabled: true } }],
  })
  assert.equal(result.resolved, true)
  assert.equal(result.created, false)
  assert.equal(result.binding.accountId, 'owner-a')
})

test('missing ambiguous or malformed owner binding fails closed', () => {
  const { file } = tempFile()
  assert.equal(readPaperAutoExecutionOwnerBinding({ bindingPath: file }).resolved, false)
  const ambiguous = bootstrapPaperAutoExecutionOwnerBinding({
    bindingPath: file,
    accounts: [
      { id: 'a', status: 'active', emailVerified: true, notificationPreferences: { exitEmailEnabled: true } },
      { id: 'b', status: 'active', emailVerified: true, notificationPreferences: { exitEmailEnabled: true } },
    ],
  })
  assert.equal(ambiguous.resolved, false)
  assert.equal(fs.existsSync(file), false)
  fs.writeFileSync(file, '{"version":"wrong","accountId":"a"}\n', { mode: 0o600 })
  assert.equal(readPaperAutoExecutionOwnerBinding({ bindingPath: file }).resolved, false)
  const malformedBefore = fs.readFileSync(file, 'utf8')
  const malformedBootstrap = bootstrapPaperAutoExecutionOwnerBinding({
    bindingPath: file,
    accounts: [{ id: 'owner-c', status: 'active', emailVerified: true, notificationPreferences: { exitEmailEnabled: true } }],
  })
  assert.equal(malformedBootstrap.resolved, false)
  assert.equal(malformedBootstrap.created, false)
  assert.equal(malformedBootstrap.status, 'PAPER_EXECUTION_OWNER_BINDING_INVALID')
  assert.equal(fs.readFileSync(file, 'utf8'), malformedBefore)
})
