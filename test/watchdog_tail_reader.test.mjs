import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLatestJsonlValue } from '../src/scanner/jsonl_tail_reader.mjs';
import { readLatestWatchdogIncident } from '../src/scanner/ops_ai_scanner_watchdog.mjs';

const parse = text => { try { return JSON.parse(text); } catch { return null; } };
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watchdog-tail-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'ledger.jsonl');
}

test('watchdog tail readers preserve their distinct legacy semantics', t => {
  const file = fixture(t);
  assert.equal(readLatestWatchdogIncident({ ledgerPath: file }), null);
  const lines = ['', ' ', '\r', 'invalid', 'null', 'false', '0', '""', '[]', '{"open":true}', '{"open":false}', '\uFEFF{"bom":true}', '{"bom":true}\uFEFF'];
  for (const first of lines) for (const last of lines) for (const ending of ['', '\n', '\r\n\n']) {
    const text = first + '\r\n' + last + ending;
    fs.writeFileSync(file, text);
    const opsExpected = text.split(/\r?\n/).filter(Boolean).map(parse).filter(Boolean).at(-1) ?? null;
    const infraExpected = parse(text.trim().split(/\r?\n/).filter(Boolean).at(-1)) ?? null;
    assert.deepEqual(readLatestWatchdogIncident({ ledgerPath: file }), opsExpected, JSON.stringify(text));
    assert.deepEqual(readLatestJsonlValue(file, { trimEmpty: true }), infraExpected, JSON.stringify(text));
  }
});

test('backward reads preserve UTF-8 across chunks and skip malformed ops records', t => {
  const file = fixture(t);
  const expected = { message: 'é📈'.repeat(30000) };
  fs.writeFileSync(file, 'invalid\n' + JSON.stringify(expected) + '\r\ninvalid\nnull\nfalse\n');
  assert.deepEqual(readLatestWatchdogIncident({ ledgerPath: file }), expected);
  assert.equal(readLatestJsonlValue(file, { trimEmpty: true }), false);
  fs.renameSync(file, file + '.closed');
});

test('large watchdog ledger reads one chunk for the latest small record', t => {
  const file = fixture(t);
  const fd = fs.openSync(file, 'w');
  const tail = Buffer.from('\n{"latest":true}\n');
  fs.writeSync(fd, tail, 0, tail.length, 321_000_000);
  fs.closeSync(fd);
  const original = fs.readSync;
  let bytes = 0;
  t.mock.method(fs, 'readSync', (...args) => { const count = original(...args); bytes += count; return count; });
  assert.deepEqual(readLatestWatchdogIncident({ ledgerPath: file }), { latest: true });
  assert.equal(bytes, 65536);
  bytes = 0;
  assert.deepEqual(readLatestJsonlValue(file, { trimEmpty: true }), { latest: true });
  assert.equal(bytes, 65536);
});
