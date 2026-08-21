import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('automatic owned monitor lets the under-five fetch sample freshness after async broker reads', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(
    source,
    /fetchSymbols:\(\{nowMs:_ignoredNowMs,\.\.\.a\}\)=>fetchAlpacaUnderFiveUniverseReadonly\(\{\.\.\.a,credentialResolver:resolveInternalOwnerAlpacaReadonlyCredentials\}\)/
  );
});
