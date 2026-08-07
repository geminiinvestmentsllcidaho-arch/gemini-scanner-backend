import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveInternalOwnerAlpacaReadonlyCredentials,
} from "../src/scanner/internal_owner_alpaca_readonly_credentials.mjs";
import {
  writeInternalOwnerTenantCredentialEnvelope,
} from "../src/scanner/internal_owner_tenant_credential_store.mjs";
import {
  setAlpacaMasterAccessSwitchState,
} from "../src/scanner/alpaca_master_access_switch.mjs";

const TENANT_ID = "gemini-investments-internal";
const MASTER_KEY = "0123456789abcdef0123456789abcdef";

test("resolves encrypted alpaca paper credentials into read-only runtime env", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-alpaca-read-"));
  const storePath = path.join(dir, "credentials.enc.json");
  const accessSwitchPath = path.join(dir, "alpaca-access-switch.json");
  await setAlpacaMasterAccessSwitchState({ enabled: true, updatedBy: "test" }, { statePath: accessSwitchPath });

  writeInternalOwnerTenantCredentialEnvelope({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    storePath,
    credentials: {
      broker: "alpaca-paper",
      apiKeyId: "test-key-id",
      apiSecret: "test-secret",
    },
  });

  const resolved = await resolveInternalOwnerAlpacaReadonlyCredentials({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    storePath,
    accessSwitchPath,
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.readyForReadonlyBrokerRead, true);
  assert.equal(resolved.secretsExposed, false);
  assert.equal(resolved.paperOnly, true);
  assert.equal(resolved.readOnly, true);
  assert.equal(resolved.brokerMutationAllowed, false);
  assert.equal(resolved.orderPlacementAllowed, false);
  assert.equal(resolved.env.ALPACA_KEY, "test-key-id");
  assert.equal(resolved.env.ALPACA_SECRET, "test-secret");
  assert.equal(resolved.env.APCA_API_BASE_URL, "https://paper-api.alpaca.markets");
});

test("blocks malformed broker credentials without exposing secrets", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-alpaca-read-block-"));
  const storePath = path.join(dir, "credentials.enc.json");
  const accessSwitchPath = path.join(dir, "alpaca-access-switch.json");
  await setAlpacaMasterAccessSwitchState({ enabled: true, updatedBy: "test" }, { statePath: accessSwitchPath });

  writeInternalOwnerTenantCredentialEnvelope({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    storePath,
    credentials: {
      broker: "wrong-broker",
      apiKeyId: "test-key-id",
      apiSecret: "test-secret",
    },
  });

  const resolved = await resolveInternalOwnerAlpacaReadonlyCredentials({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    storePath,
    accessSwitchPath,
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.validBroker, false);
  assert.equal(resolved.readyForReadonlyBrokerRead, false);
  assert.deepEqual(resolved.env, {});
  assert.equal(JSON.stringify(resolved).includes("test-secret"), false);
});

test("fails closed when encrypted credential store cannot be read", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-alpaca-read-missing-"));
  const accessSwitchPath = path.join(dir, "alpaca-access-switch.json");
  await setAlpacaMasterAccessSwitchState({ enabled: true, updatedBy: "test" }, { statePath: accessSwitchPath });

  const resolved = await resolveInternalOwnerAlpacaReadonlyCredentials({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    storePath: path.join(dir, "does-not-exist.enc.json"),
    accessSwitchPath,
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.readyForReadonlyBrokerRead, false);
  assert.equal(resolved.brokerMutationAllowed, false);
  assert.equal(resolved.orderPlacementAllowed, false);
  assert.deepEqual(resolved.env, {});
});


test("master switch OFF blocks encrypted credential resolution", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-alpaca-read-off-"));
  const storePath = path.join(dir, "credentials.enc.json");
  const accessSwitchPath = path.join(dir, "alpaca-access-switch.json");

  writeInternalOwnerTenantCredentialEnvelope({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    storePath,
    credentials: {
      broker: "alpaca-paper",
      apiKeyId: "test-key-id",
      apiSecret: "test-secret",
    },
  });

  const resolved = await resolveInternalOwnerAlpacaReadonlyCredentials({
    tenantId: TENANT_ID,
    masterKey: MASTER_KEY,
    storePath,
    accessSwitchPath,
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.accessSwitchEnabled, false);
  assert.equal(resolved.readyForReadonlyBrokerRead, false);
  assert.equal(resolved.credentialStoreReadable, false);
  assert.equal(resolved.apiKeyPresent, false);
  assert.equal(resolved.apiSecretPresent, false);
  assert.deepEqual(resolved.env, {});
  assert.equal(JSON.stringify(resolved).includes("test-secret"), false);
});
