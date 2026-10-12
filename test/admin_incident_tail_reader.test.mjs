import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLatestAdminOperationalIncident as read } from '../src/scanner/admin_operational_incident_router.mjs';

test('tail reader preserves last-line semantics, CRLF, empty lines and malformed tails', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-tail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ledgerPath = path.join(dir, 'ledger.jsonl');
  assert.equal(read({ ledgerPath }), null);
  for (const text of ['', '\n\r\n', '{"a":1}', '{"a":1}\n\n', '{"a":1}\r\n\r\n', '{"a":1}\n{"a":2}\n', '{"a":1}\ninvalid', '{"a":1}\n ', '{"a":1}\n\r', 'invalid\n{"a":2}']) {
    fs.writeFileSync(ledgerPath, text);
    let expected = null;
    try { const lines = text.split(/\r?\n/).filter(Boolean); expected = lines.length ? JSON.parse(lines.at(-1)) : null; } catch {}
    assert.deepEqual(read({ ledgerPath }), expected, JSON.stringify(text));
  }
});

test('records crossing read boundaries retain UTF-8 and close the file', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-tail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ledgerPath = path.join(dir, 'ledger.jsonl');
  const expected = { message: 'é📈'.repeat(30000) };
  fs.writeFileSync(ledgerPath, '{"old":true}\n' + JSON.stringify(expected) + '\r\n\n');
  assert.deepEqual(read({ ledgerPath }), expected);
  fs.renameSync(ledgerPath, ledgerPath + '.closed');
});

test('large ledger reads at most one chunk for a small final record', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incident-tail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ledgerPath = path.join(dir, 'ledger.jsonl');
  const fd = fs.openSync(ledgerPath, 'w');
  fs.writeSync(fd, Buffer.from('\n{"latest":true}\n'), 0, 17, 290_662_347);
  fs.closeSync(fd);
  const original = fs.readSync;
  let bytes = 0;
  t.mock.method(fs, 'readSync', (...args) => { const count = original(...args); bytes += count; return count; });
  assert.deepEqual(read({ ledgerPath }), { latest: true });
  assert.equal(bytes, 65536);
});
