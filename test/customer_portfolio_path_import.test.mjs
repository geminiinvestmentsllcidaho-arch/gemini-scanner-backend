import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('customer portfolio imports node:path for Stage 1 status resolution', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(source, /import path from ["']node:path["'];/);
  assert.match(source, /path\.join\(process\.cwd\(\), ['"]runs['"], ['"]paper_manual_round_trip_status\.json['"]\)/);
});
