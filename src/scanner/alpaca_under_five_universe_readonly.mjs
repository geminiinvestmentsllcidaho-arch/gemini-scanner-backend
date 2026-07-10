import {
  resolveInternalOwnerAlpacaReadonlyCredentials,
} from "./internal_owner_alpaca_readonly_credentials.mjs";

export const VERSION = "alpaca_under_five_universe_readonly_v1";

const PAPER_BASE_URL = "https://paper-api.alpaca.markets";
const DATA_BASE_URL = "https://data.alpaca.markets";

function clean(value) {
  return String(value ?? "").trim();
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function chunks(values, size) {
  const out = [];
  for (let index = 0; index < values.length; index += size) {
    out.push(values.slice(index, index + size));
  }
  return out;
}

function latestPrice(snapshot = {}) {
  return finite(
    snapshot?.latestTrade?.p ??
    snapshot?.minuteBar?.c ??
    snapshot?.dailyBar?.c ??
    snapshot?.prevDailyBar?.c
  );
}

function latestVolume(snapshot = {}) {
  return finite(snapshot?.dailyBar?.v ?? snapshot?.minuteBar?.v) ?? 0;
}

async function readJson(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { method: "GET", headers });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: response.ok, statusCode: response.status, json };
}

export async function fetchAlpacaUnderFiveUniverseReadonly({
  env = process.env,
  fetchImpl = globalThis.fetch,
  credentialResolver = resolveInternalOwnerAlpacaReadonlyCredentials,
  credentialOptions = {},
  minPrice = 0.5,
  maxPrice = 5,
  minDailyVolume = 100000,
  snapshotBatchSize = 200,
  maxAssets = 10000,
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

  const runtime = {
    credentialSource,
    paperOnly: true,
    readOnly: true,
    allowedMethods: Object.freeze(["GET"]),
    secretsRedacted: true,
    brokerContactAllowed: true,
    orderSubmitAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  };

  const filters = {
    minPrice: Number(minPrice),
    maxPrice: Number(maxPrice),
    minDailyVolume: Number(minDailyVolume),
  };

  if (!apiKey || !apiSecret) {
    return {
      ok: true,
      version: VERSION,
      status: "not_connected_readonly",
      runtime,
      filters,
      assetCount: 0,
      snapshotCount: 0,
      candidateCount: 0,
      candidates: [],
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      version: VERSION,
      status: "fetch_unavailable",
      runtime,
      filters,
      assetCount: 0,
      snapshotCount: 0,
      candidateCount: 0,
      candidates: [],
    };
  }

  const headers = {
    "APCA-API-KEY-ID": apiKey,
    "APCA-API-SECRET-KEY": apiSecret,
    Accept: "application/json",
  };

  const assetsUrl = new URL("/v2/assets", PAPER_BASE_URL);
  assetsUrl.searchParams.set("status", "active");
  assetsUrl.searchParams.set("asset_class", "us_equity");

  const assetsResult = await readJson(fetchImpl, assetsUrl.toString(), headers);
  if (!assetsResult.ok || !Array.isArray(assetsResult.json)) {
    return {
      ok: false,
      version: VERSION,
      status: "asset_fetch_failed",
      runtime,
      filters,
      fetchStatus: { assets: assetsResult.statusCode },
      assetCount: 0,
      snapshotCount: 0,
      candidateCount: 0,
      candidates: [],
    };
  }

  const assets = assetsResult.json
    .map((asset) => ({
      symbol: clean(asset.symbol).toUpperCase(),
    name: clean(asset.name),
      exchange: clean(asset.exchange),
      status: clean(asset.status),
      tradable: asset.tradable === true,
      fractionable: asset.fractionable === true,
    }))
    .filter((asset) =>
      asset.symbol &&
      asset.status === "active" &&
      asset.tradable === true &&
      ["NYSE", "NASDAQ", "AMEX", "ARCA", "BATS"].includes(asset.exchange)
    )
    .slice(0, Math.max(1, Number(maxAssets) || 10000));
  const snapshotMap = {};
  let snapshotCount = 0;

  for (const batch of chunks(
    assets.map((asset) => asset.symbol),
    Math.max(1, Number(snapshotBatchSize) || 200)
  )) {
    const snapshotsUrl = new URL("/v2/stocks/snapshots", DATA_BASE_URL);
    snapshotsUrl.searchParams.set("symbols", batch.join(","));
    snapshotsUrl.searchParams.set("feed", clean(env?.ALPACA_DATA_FEED) || "iex");

    const snapshotsResult = await readJson(fetchImpl, snapshotsUrl.toString(), headers);
    if (!snapshotsResult.ok || !snapshotsResult.json || typeof snapshotsResult.json !== "object") {
      continue;
    }

    for (const [symbol, snapshot] of Object.entries(snapshotsResult.json)) {
      snapshotMap[symbol] = snapshot;
      snapshotCount += 1;
    }
  }

  const candidates = assets
    .map((asset) => {
      const snapshot = snapshotMap[asset.symbol] || {};
      const price = latestPrice(snapshot);
      const dailyVolume = latestVolume(snapshot);
      return {
        ...asset,
        price,
        dailyVolume,
        dollarVolume: price === null ? null : Number((price * dailyVolume).toFixed(2)),
      };
    })
    .filter((asset) =>
      asset.price !== null &&
      asset.price >= filters.minPrice &&
      asset.price <= filters.maxPrice &&
      asset.dailyVolume >= filters.minDailyVolume
    )
    .sort((left, right) =>
      (right.dollarVolume ?? 0) - (left.dollarVolume ?? 0) ||
      left.symbol.localeCompare(right.symbol)
    );

  return {
    ok: true,
    version: VERSION,
    status: "connected_readonly",
    runtime,
    filters,
    assetCount: assets.length,
    snapshotCount,
    candidateCount: candidates.length,
    candidates,
  };
}
