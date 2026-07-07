import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const lockRoute = "/app/paper-broker-adapter-approval-lock";
const recordRoute = "/app/paper-broker-adapter-approval-record-tool";

test("app screens that link approval lock also link approval record tool", async () => {
  const root = new URL("../src/scanner/", import.meta.url);
  const files = (await readdir(root)).filter((name) => name.endsWith("app_screen.mjs"));
  const missing = [];

  for (const name of files) {
    const text = await readFile(new URL(name, root), "utf8");
    const related = text.includes("Related Broker Readiness Routes")
      || text.includes("RELATED_ROUTES")
      || text.includes("RELATED_BROKER_READINESS_ROUTES");
    if ((text.includes(lockRoute) || related) && !text.includes(recordRoute)) {
      missing.push(name);
    }
  }

  assert.deepEqual(missing, []);
});
