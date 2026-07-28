import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("customer under-five bridge ranks the current shared-cache candidates instead of historical dryruns", () => {
  assert.match(
    server,
    /function readUnderFiveLiveRankings\(source = \{\}\) \{[\s\S]*rows = Array\.isArray\(source\?\.candidates\)[\s\S]*readScannerRankings\(\{[\s\S]*rows,[\s\S]*nowMs: Date\.now\(\),[\s\S]*\}\);[\s\S]*\}/
  );
  assert.match(
    server,
    /return bridgeCustomerZeroFreshRankings\(source, readUnderFiveLiveRankings\(source\), getStreamTelemetry\(\)\);/
  );
  assert.doesNotMatch(
    server,
    /return bridgeCustomerZeroFreshRankings\(source, readScannerRankings\(\)\);/
  );
});

test("freshness diagnostic uses the latest under-five shared-cache snapshot as ranking input", () => {
  assert.match(
    server,
    /const latestSource = cache\?\.getLatest\?\.\(\) \?\? null;[\s\S]*rankingRoot: readUnderFiveLiveRankings\(latestSource\)/
  );
});
