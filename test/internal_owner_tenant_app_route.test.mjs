import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const serverSource = fs.readFileSync(
  new URL("../src/server.js", import.meta.url),
  "utf8"
);

test("server registers internal owner bootstrap app route", () => {
  assert.equal(
    serverSource.includes('app.get("/app/internal-owner"'),
    true
  );
  assert.equal(
    serverSource.includes("renderInternalOwnerTenantAppScreenHtml(buildInternalOwnerTenantAppScreen())"),
    true
  );
});

test("internal owner bootstrap app route remains GET-only", () => {
  for (const method of ["post", "put", "patch", "delete"]) {
    assert.equal(
      serverSource.includes(`app.${method}("/app/internal-owner"`),
      false
    );
  }
});
