import test from "node:test";
import assert from "node:assert/strict";
import {
  createRequireInternalOwnerAuthorization,
  evaluateInternalOwnerAuthorization,
} from "../src/scanner/internal_owner_authorization.mjs";

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

test("internal owner authorization allows exact internal tenant and owner role", () => {
  const decision = evaluateInternalOwnerAuthorization({
    tenantId: "gemini-investments-internal",
    role: "owner",
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "internal_owner_authorized");
  assert.equal(decision.tenantMatch, true);
  assert.equal(decision.roleMatch, true);
});

test("internal owner authorization denies tenant or role mismatch", () => {
  assert.equal(
    evaluateInternalOwnerAuthorization({
      tenantId: "other-tenant",
      role: "owner",
    }).reason,
    "internal_owner_tenant_denied"
  );

  assert.equal(
    evaluateInternalOwnerAuthorization({
      tenantId: "gemini-investments-internal",
      role: "viewer",
    }).reason,
    "internal_owner_role_denied"
  );
});

test("internal owner authorization middleware attaches fixed server context", () => {
  const authz = createRequireInternalOwnerAuthorization();
  const req = {};
  const res = createMockRes();
  let nextCalled = false;

  authz(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.internalOwnerAuthorization, {
    tenantId: "gemini-investments-internal",
    role: "owner",
    policy: "internal_owner_exact_tenant_role_v1",
  });
});

test("internal owner authorization middleware returns 403 for invalid configured policy", () => {
  const authz = createRequireInternalOwnerAuthorization({
    tenantId: "other-tenant",
    role: "viewer",
  });
  const res = createMockRes();

  authz({}, res, () => {
    throw new Error("next should not run");
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "internal_owner_authorization_required");
});
