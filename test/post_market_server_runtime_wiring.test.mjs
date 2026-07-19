import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("server imports and constructs the post-market runtime worker", () => {
  assert.match(
    source,
    /import \{ createPostMarketRuntimeWorker \} from '\.\/scanner\/post_market_runtime_worker\.mjs';/,
  );
  assert.match(
    source,
    /const postMarketRuntimeWorker = createPostMarketRuntimeWorker\(\{/,
  );
  assert.match(source, /getMarketClock: async \(\) => \{/);
  assert.match(source, /return source\?\.marketClock \?\? \{\};/);
});

test("server starts post-market runtime in the listen lifecycle", () => {
  assert.match(
    source,
    /const postMarketRuntimeStatus = postMarketRuntimeWorker\.start\(\);/,
  );
  assert.match(source, /\[postmarket-runtime\] worker status/);
});

test("server exposes read-only post-market runtime diagnostics", () => {
  assert.match(
    source,
    /app\.get\("\/diagnostics\/post-market-runtime", \(_req, res\) => \{/,
  );
  assert.match(source, /res\.json\(postMarketRuntimeWorker\.getStatus\(\)\);/);
});

test("server wiring does not add execution methods to the runtime worker", () => {
  assert.doesNotMatch(
    source,
    /postMarketRuntimeWorker\.(placeOrder|submitOrder|cancelOrder|mutateAccount|enableLiveTrading)/,
  );
});


test("server supplies latest bounded post-market result to background AI review", () => {
  assert.match(
    source,
    /getPostMarketResult: \(\) => postMarketRuntimeWorker\.getStatus\(\)\.lastResult/,
  );
});
