import {
  resolveInternalOwnerAlpacaReadonlyCredentials,
} from "./internal_owner_alpaca_readonly_credentials.mjs";

export const VERSION = "alpaca_market_clock_readonly_v1";
const PAPER_BASE_URL = "https://paper-api.alpaca.markets";

function clean(value) {
  return String(value ?? "").trim();
}

function lockedRuntime(credentialSource, brokerContactAllowed) {
  return Object.freeze({
    credentialSource,
    paperOnly: true,
    readOnly: true,
    allowedMethods: Object.freeze(["GET"]),
    secretsRedacted: true,
    brokerContactAllowed,
    orderSubmitAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export async function fetchAlpacaMarketClockReadonly({
  env = process.env,
  fetchImpl = globalThis.fetch,
  credentialResolver = resolveInternalOwnerAlpacaReadonlyCredentials,
  credentialOptions = {},
} = {}) {
  const resolved = typeof credentialResolver === "function"
    ? credentialResolver({
        masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY,
        ...credentialOptions,
      })
    : null;
  const effectiveEnv = resolved?.readyForReadonlyBrokerRead === true
    ? { ...env, ...resolved.env }
    : env;
  const apiKey = clean(effectiveEnv?.ALPACA_KEY);
  const apiSecret = clean(effectiveEnv?.ALPACA_SECRET);
  const credentialSource = resolved?.readyForReadonlyBrokerRead === true
    ? "encrypted_tenant_store"
    : "runtime_env";

  if (!apiKey || !apiSecret) {
    return Object.freeze({
      ok: true,
      version: VERSION,
      status: "not_connected_readonly",
      runtime: lockedRuntime(credentialSource, false),
      marketClock: Object.freeze({
        isOpen: false,
        timestamp: null,
        nextOpen: null,
        nextClose: null,
      }),
    });
  }

  if (typeof fetchImpl !== "function") {
    return Object.freeze({
      ok: false,
      version: VERSION,
      status: "fetch_unavailable",
      runtime: lockedRuntime(credentialSource, false),
      marketClock: Object.freeze({
        isOpen: false,
        timestamp: null,
        nextOpen: null,
        nextClose: null,
      }),
    });
  }

  const response = await fetchImpl(new URL("/v2/clock", PAPER_BASE_URL).toString(), {
    method: "GET",
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
      Accept: "application/json",
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  const marketClock = response.ok && json && typeof json === "object"
    ? Object.freeze({
        isOpen: json.is_open === true,
        timestamp: json.timestamp ?? null,
        nextOpen: json.next_open ?? null,
        nextClose: json.next_close ?? null,
      })
    : Object.freeze({
        isOpen: false,
        timestamp: null,
        nextOpen: null,
        nextClose: null,
      });

  return Object.freeze({
    ok: response.ok,
    version: VERSION,
    status: response.ok ? "connected_readonly" : "clock_fetch_failed",
    statusCode: response.status,
    runtime: lockedRuntime(credentialSource, true),
    marketClock,
  });
}

export default Object.freeze({
  VERSION,
  fetchAlpacaMarketClockReadonly,
});
