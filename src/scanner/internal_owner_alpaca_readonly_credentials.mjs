import {
  readInternalOwnerTenantCredentials,
} from "./internal_owner_tenant_credential_store.mjs";
import {
  getAlpacaMasterAccessSwitchState,
  alpacaMasterAccessAllowsReadonly,
} from "./alpaca_master_access_switch.mjs";

export const VERSION = "internal_owner_alpaca_readonly_credentials_v1";
export const DEFAULT_TENANT_ID = "gemini-investments-internal";

function clean(value) {
  return String(value ?? "").trim();
}

export async function resolveInternalOwnerAlpacaReadonlyCredentials(options = {}) {
  const tenantId = clean(options.tenantId) || DEFAULT_TENANT_ID;
  const masterKey = clean(options.masterKey);
  const storePath = options.storePath;
  const baseUrl = clean(options.baseUrl) || "https://paper-api.alpaca.markets";

  const accessState = await getAlpacaMasterAccessSwitchState({
    ...(options.accessSwitchPath ? { statePath: options.accessSwitchPath } : {}),
    ...(Number.isFinite(Number(options.nowMs)) ? { nowMs: Number(options.nowMs) } : {}),
  });

  if (!alpacaMasterAccessAllowsReadonly(accessState)) {
    return {
      ok: true,
      version: VERSION,
      tenantId,
      source: "encrypted_tenant_store",
      credentialStoreReadable: false,
      broker: "",
      validBroker: false,
      apiKeyPresent: false,
      apiSecretPresent: false,
      readyForReadonlyBrokerRead: false,
      accessSwitchEnabled: false,
      accessMode: accessState.accessMode,
      accessReason: accessState.reason,
      secretsExposed: false,
      paperOnly: true,
      readOnly: true,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      env: Object.freeze({}),
    };
  }

  try {
    const credentials = readInternalOwnerTenantCredentials({
      tenantId,
      masterKey,
      ...(storePath ? { storePath } : {}),
    });

    const apiKeyId = clean(credentials.apiKeyId);
    const apiSecret = clean(credentials.apiSecret);
    const broker = clean(credentials.broker);

    const validBroker = broker === "alpaca-paper";
    const ready = validBroker && Boolean(apiKeyId && apiSecret);

    return {
      ok: true,
      version: VERSION,
      tenantId,
      source: "encrypted_tenant_store",
      credentialStoreReadable: true,
      broker,
      validBroker,
      apiKeyPresent: Boolean(apiKeyId),
      apiSecretPresent: Boolean(apiSecret),
      readyForReadonlyBrokerRead: ready,
      accessSwitchEnabled: true,
      accessMode: accessState.accessMode,
      accessReason: accessState.reason,
      secretsExposed: false,
      paperOnly: true,
      readOnly: true,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      env: ready
        ? Object.freeze({
            ALPACA_KEY: apiKeyId,
            ALPACA_SECRET: apiSecret,
            APCA_API_BASE_URL: baseUrl,
            ALPACA_PAPER_TRADING: "true",
          })
        : Object.freeze({}),
    };
  } catch (error) {
    return {
      ok: false,
      version: VERSION,
      tenantId,
      source: "encrypted_tenant_store",
      credentialStoreReadable: false,
      broker: "",
      validBroker: false,
      apiKeyPresent: false,
      apiSecretPresent: false,
      readyForReadonlyBrokerRead: false,
      secretsExposed: false,
      paperOnly: true,
      readOnly: true,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      errorCode: clean(error?.message) || "credential_store_read_failed",
      env: Object.freeze({}),
    };
  }
}
