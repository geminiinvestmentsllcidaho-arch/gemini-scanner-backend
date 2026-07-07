import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("app screens that link approval record tool also link paper operator start here", async () => {
  const scannerDir = new URL("../src/scanner/", import.meta.url);
  const names = await readdir(scannerDir);
  const files = names
    .filter((name) => name.endsWith("_app_screen.mjs") || name.endsWith("_panel.mjs"))
    .map((name) => path.join(scannerDir.pathname, name));

  const missing = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (source.includes("Paper Broker Adapter Approval Record Tool") && !source.includes("Paper Operator Start Here")) {
      missing.push(path.relative(process.cwd(), file));
    }
  }

  assert.deepEqual(missing, []);
});
