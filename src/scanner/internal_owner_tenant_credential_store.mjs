import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const VERSION = "internal_owner_tenant_credential_store_v1";
const POLICY = "aes_256_gcm_per_tenant_envelope_v1";
const DEFAULT_TENANT_ID = "gemini-investments-internal";
const DEFAULT_STORE_PATH = path.resolve("runs/internal_owner_tenant_credentials.enc.json");

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function deriveKey(masterKey, tenantId) {
  return crypto.scryptSync(masterKey, `gemini-scanner:${tenantId}`, 32);
}

export function buildInternalOwnerTenantCredentialStoreStatus(options = {}) {
  const tenantId = clean(options.tenantId, DEFAULT_TENANT_ID);
  const storePath = clean(options.storePath, DEFAULT_STORE_PATH);
  const keyConfigured = clean(options.masterKey, "").length >= 32;

  return {
    ok: true,
    version: VERSION,
    tenantId,
    storageMode: "encrypted_local_file_per_tenant",
    encryptionImplemented: true,
    encryptionPolicy: POLICY,
    keyConfigured,
    storeExists: fs.existsSync(storePath),
    storePathLabel: path.basename(storePath),
    rawSecretsExposed: false,
    readOnlyStatus: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
  };
}

export function encryptInternalOwnerTenantCredentials(options = {}) {
  const tenantId = clean(options.tenantId, DEFAULT_TENANT_ID);
  const masterKey = clean(options.masterKey, "");
  const credentials = options.credentials && typeof options.credentials === "object"
    ? options.credentials
    : {};

  if (masterKey.length < 32) {
    throw new Error("credential_master_key_too_short");
  }

  const iv = crypto.randomBytes(12);
  const key = deriveKey(masterKey, tenantId);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(tenantId, "utf8"));

  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Object.freeze({
    version: VERSION,
    policy: POLICY,
    tenantId,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

export function decryptInternalOwnerTenantCredentials(options = {}) {
  const envelope = options.envelope && typeof options.envelope === "object"
    ? options.envelope
    : {};
  const tenantId = clean(options.tenantId, DEFAULT_TENANT_ID);
  const masterKey = clean(options.masterKey, "");

  if (masterKey.length < 32) {
    throw new Error("credential_master_key_too_short");
  }
  if (clean(envelope.tenantId) !== tenantId) {
    throw new Error("credential_tenant_mismatch");
  }

  const key = deriveKey(masterKey, tenantId);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(clean(envelope.iv), "base64"),
  );
  decipher.setAAD(Buffer.from(tenantId, "utf8"));
  decipher.setAuthTag(Buffer.from(clean(envelope.authTag), "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(clean(envelope.ciphertext), "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8"));
}

export function readInternalOwnerTenantCredentials(options = {}) {
  const tenantId = clean(options.tenantId, DEFAULT_TENANT_ID);
  const storePath = clean(options.storePath, DEFAULT_STORE_PATH);
  const masterKey = clean(options.masterKey, "");

  if (!fs.existsSync(storePath)) {
    throw new Error("credential_store_not_found");
  }

  const envelope = JSON.parse(fs.readFileSync(storePath, "utf8"));
  return decryptInternalOwnerTenantCredentials({
    tenantId,
    masterKey,
    envelope,
  });
}

export function writeInternalOwnerTenantCredentialEnvelope(options = {}) {
  const storePath = clean(options.storePath, DEFAULT_STORE_PATH);
  const envelope = encryptInternalOwnerTenantCredentials(options);

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return buildInternalOwnerTenantCredentialStoreStatus({
    tenantId: envelope.tenantId,
    storePath,
    masterKey: options.masterKey,
  });
}
