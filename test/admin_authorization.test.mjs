import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequireAdminAuthorization,
  evaluateAdminAuthorization,
} from "../src/scanner/admin_authorization.mjs";

const token = "correct-admin-token-123456";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("admin authorization requires the configured strong token", () => {
  const denied = evaluateAdminAuthorization("wrong-token", { token });
  const allowed = evaluateAdminAuthorization(token, { token });

  assert.equal(denied.allowed, false);
  assert.equal(denied.role, "admin");
  assert.equal(denied.reason, "admin_authorization_required");
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, "admin_authorized");
});

test("admin authorization fails closed when no strong token is configured", () => {
  const decision = evaluateAdminAuthorization("", { token: "weak" });

  assert.equal(decision.allowed, false);
  assert.equal(decision.enabled, false);
  assert.equal(decision.reason, "admin_authorization_disabled");
});

test("admin middleware derives authorization from protected token only", () => {
  const middleware = createRequireAdminAuthorization({ token });
  const res = responseRecorder();
  let nextCalled = false;

  middleware(
    { headers: { authorization: `Bearer ${token}`, "x-role": "customer" } },
    res,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);

  const deniedRes = responseRecorder();
  middleware(
    { headers: { "x-role": "admin" } },
    deniedRes,
    () => assert.fail("untrusted role header must not authorize")
  );

  assert.equal(deniedRes.statusCode, 403);
  assert.equal(deniedRes.body.error, "admin_authorization_required");
});
