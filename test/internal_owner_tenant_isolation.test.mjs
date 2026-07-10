import test from "node:test";
import assert from "node:assert/strict";
import {
  createRequireInternalOwnerTenantIsolation,
  evaluateInternalOwnerTenantIsolation,
} from "../src/scanner/internal_owner_tenant_isolation.mjs";

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("internal owner tenant isolation allows only the fixed internal tenant", () => {
  const allowed = evaluateInternalOwnerTenantIsolation({
    tenantId: "gemini-investments-internal",
  });
  const denied = evaluateInternalOwnerTenantIsolation({
    tenantId: "other-tenant",
  });

  assert.equal(allowed.isolated, true);
  assert.equal(allowed.policy, "internal_owner_single_tenant_request_scope_v1");
  assert.equal(denied.isolated, false);
});

test("internal owner tenant isolation middleware scopes request from authorization context", () => {
  const middleware = createRequireInternalOwnerTenantIsolation();
  const req = {
    internalOwnerAuthorization: {
      tenantId: "gemini-investments-internal",
      role: "owner",
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.internalOwnerTenantContext, {
    tenantId: "gemini-investments-internal",
    isolationPolicy: "internal_owner_single_tenant_request_scope_v1",
  });
});

test("internal owner tenant isolation middleware denies missing or mismatched tenant context", () => {
  const middleware = createRequireInternalOwnerTenantIsolation();
  const res = createMockRes();

  middleware({}, res, () => {
    throw new Error("next should not run");
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "internal_owner_tenant_isolation_required");
});
