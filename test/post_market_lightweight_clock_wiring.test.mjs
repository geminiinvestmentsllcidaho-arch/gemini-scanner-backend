import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("post-market planning uses the dedicated lightweight market clock", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const workerStart = server.indexOf("const postMarketRuntimeWorker = createPostMarketRuntimeWorker");
  const workerEnd = server.indexOf("app.listen(", workerStart);
  const block = server.slice(workerStart, workerEnd);

  assert.match(block, /fetchAlpacaMarketClockReadonly/);
  assert.doesNotMatch(block, /getUnderFiveSharedSource/);
});
