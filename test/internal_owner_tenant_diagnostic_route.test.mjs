import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const serverSource = fs.readFileSync(
  new URL("../src/server.js", import.meta.url),
  "utf8"
);

test("server exposes internal owner tenant read-only diagnostic route", () => {
  assert.equal(
    serverSource.includes('app.get("/diagnostics/internal-owner-tenant-readonly", requireInternalOwnerAuth, requireInternalOwnerAuthorization, requireInternalOwnerTenantIsolation'),
    true
  );
  assert.equal(
    serverSource.includes("res.json(buildInternalOwnerTenantReadonly({"),
    true
  );
  assert.equal(
    serverSource.includes("credentialStoreStatus: buildInternalOwnerTenantCredentialStoreStatus({"),
    true
  );

});

test("internal owner tenant diagnostic route remains GET-only", () => {
  for (const method of ["post", "put", "patch", "delete"]) {
    assert.equal(
      serverSource.includes(`app.${method}("/diagnostics/internal-owner-tenant-readonly"`),
      false
    );
  }
});
