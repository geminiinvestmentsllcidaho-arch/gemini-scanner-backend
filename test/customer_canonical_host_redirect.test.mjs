import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('customer application canonicalizes www host before session handling', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const hostnameCheck = "String(req.hostname ?? '').toLowerCase() !== 'www.geminiscanner.net'";
  const redirect = "res.redirect(301, `https://geminiscanner.net${req.originalUrl || '/'}`)";
  const canonicalIndex = source.indexOf(hostnameCheck);
  const redirectIndex = source.indexOf(redirect);
  const bodyParserIndex = source.indexOf("app.use(express.json())");
  assert.ok(canonicalIndex > -1);
  assert.ok(redirectIndex > canonicalIndex);
  assert.ok(bodyParserIndex > redirectIndex);
});
