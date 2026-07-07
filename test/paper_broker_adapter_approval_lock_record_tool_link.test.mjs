import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("approval lock app route links to approval record tool", async () => {
  const server = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  const start = server.indexOf("app.get('/app/paper-broker-adapter-approval-lock'");
  assert.notEqual(start, -1);
  const end = server.indexOf("app.get('/diagnostics/paper-broker-adapter-approval-lock'", start);
  assert.notEqual(end, -1);
  const block = server.slice(start, end);
  assert.match(block, /\/app\/paper-broker-adapter-approval-record-tool/);
  assert.match(block, /Paper Broker Adapter Approval Record Tool/);
});
