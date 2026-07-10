import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildInternalOwnerTenantCredentialStoreStatus,
  decryptInternalOwnerTenantCredentials,
  encryptInternalOwnerTenantCredentials,
  writeInternalOwnerTenantCredentialEnvelope,
} from "../src/scanner/internal_owner_tenant_credential_store.mjs";

const TENANT_ID = "gemini-investments-internal";
const MASTER_KEY = "0123456789abcdef0123456789abcdef";

test("credential store status is safe and exposes no secrets", () => {
  const status = buildInternalOwnerTenantCredentialStoreStatus({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
  });

  assert.equal(status.encryptionImplemented, true);
  assert.equal(status.encryptionPolicy, "aes_256_gcm_per_tenant_envelope_v1");
  assert.equal(status.keyConfigured, true);
  assert.equal(status.rawSecretsExposed, false);
  assert.equal(status.readOnlyStatus, true);
  assert.equal(status.brokerContactAllowed, false);
  assert.equal(status.orderPlacementAllowed, false);
});

test("credentials encrypt and decrypt only for the exact tenant", () => {
  const credentials = {
    broker: "alpaca-paper",
    apiKeyId: "example-key-id",
    apiSecret: "example-secret",
  };
  const envelope = encryptInternalOwnerTenantCredentials({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    credentials,
  });

  assert.equal(envelope.tenantId, TENANT_ID);
  assert.equal(envelope.algorithm, "aes-256-gcm");
  assert.equal(JSON.stringify(envelope).includes("example-secret"), false);
  assert.deepEqual(
    decryptInternalOwnerTenantCredentials({
      tenantId: TENANT_ID,
      masterKey: MASTER_KEY,
      envelope,
    }),
    credentials,
  );

  assert.throws(
    () => decryptInternalOwnerTenantCredentials({
      tenantId: "other-tenant",
      masterKey: MASTER_KEY,
      envelope,
    }),
    /credential_tenant_mismatch/,
  );
});

test("credential envelope writes locally with restricted permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-owner-credential-"));
  const storePath = path.join(dir, "credentials.enc.json");

  const status = writeInternalOwnerTenantCredentialEnvelope({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    credentials: { apiSecret: "local-test-secret" },
    storePath,
  });

  assert.equal(status.storeExists, true);
  assert.equal(status.storePathLabel, "credentials.enc.json");
  assert.equal(fs.readFileSync(storePath, "utf8").includes("local-test-secret"), false);
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
});
