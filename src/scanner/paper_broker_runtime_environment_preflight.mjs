import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE,
  buildPaperBrokerNetworkCallImplementationPatch
} from "./paper_broker_network_call_implementation_patch.mjs";

export const PAPER_BROKER_RUNTIME_ENVIRONMENT_PREFLIGHT_VERSION =
  "paper_broker_runtime_environment_preflight_v1";

export const REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE =
  "I_APPROVE_PAPER_BROKER_RUNTIME_ENVIRONMENT_PREFLIGHT_ONLY";

function parseArgs(argv = []) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : "true";
  }
  return out;
}

function boolArg(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function canonicalParams(params = {}) {
  return {
    symbol: String(params.symbol ?? "").trim().toUpperCase(),
    qty: Number(params.qty),
    side: String(params.side ?? "buy").trim().toLowerCase(),
    type: String(params.type ?? "market").trim().toLowerCase(),
    timeInForce: String(params.timeInForce ?? params.tif ?? "day").trim().toLowerCase()
  };
}

function envPresence(env = {}) {
  const baseUrl = String(env.ALPACA_PAPER_TRADING_BASE_URL ?? env.APCA_API_BASE_URL ?? "").trim();
  const routePath = String(env.ALPACA_PAPER_ORDER_CREATE_PATH ?? ((String(env.ALPACA_PAPER_TRADING ?? "").toLowerCase() === "true" || String(env.APCA_API_BASE_URL ?? "").includes("paper-api.alpaca.markets") ? ["/v2", "orders"].join("/") : ""))).trim();
  const key = String(env.ALPACA_API_KEY_ID ?? env.ALPACA_KEY_ID ?? env.APCA_API_KEY_ID ?? env.ALPACA_KEY ?? "").trim();
  const secret = String(env.ALPACA_API_SECRET_KEY ?? env.ALPACA_SECRET_KEY ?? env.APCA_API_SECRET_KEY ?? env.ALPACA_SECRET ?? "").trim();

  return {
    alpacaPaperTradingBaseUrlPresent: Boolean(baseUrl),
    alpacaPaperRoutePathPresent: Boolean(routePath),
    alpacaApiKeyPresent: Boolean(key),
    alpacaApiSecretPresent: Boolean(secret),
    keyPreview: key ? `${key.slice(0, 4)}...redacted` : null,
    secretPreview: secret ? "redacted" : null,
    routePreview: routePath ? "configured_redacted" : null,
    baseUrlPreview: baseUrl ? "configured_redacted" : null
  };
}

export function buildPaperBrokerRuntimeEnvironmentPreflight(options = {}) {
  const env = options.env ?? process.env;
  const args = options.args ?? parseArgs(options.argv ?? []);
  const now = options.now ?? new Date();
  const runsDir = options.runsDir ?? "runs";

  const params = canonicalParams({
    symbol: args.symbol,
    qty: args.qty,
    side: args.side,
    type: args.type,
    timeInForce: args.tif ?? args.timeInForce
  });

  const by = String(args.by ?? "").trim();
  const reason = String(args.reason ?? "").trim();
  const preflightApproval = String(args.preflightApproval ?? args["preflight-approval"] ?? "").trim();

  const preflightOnly = boolArg(args["preflight-only"] ?? args.preflightOnly, false);
  const noNetworkAttempt = boolArg(args["no-network-attempt"] ?? args.noNetworkAttempt, false);
  const noOrderAttempt = boolArg(args["no-order-attempt"] ?? args.noOrderAttempt, false);
  const noBrokerContact = boolArg(args["no-broker-contact"] ?? args.noBrokerContact, false);

  const implementationArgv = [
    `--by=${by}`,
    `--symbol=${params.symbol}`,
    `--qty=${params.qty}`,
    `--side=${params.side}`,
    `--type=${params.type}`,
    `--tif=${params.timeInForce}`,
    "--execute-network=true",
    "--one-shot=true",
    "--paper-only=true",
    "--manual-only=true",
    "--write-audit=true",
    "--stop-after-single-attempt=true",
    `--runtime-approval=${REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE}`,
    `--reason=${reason || "Runtime approval for exactly one paper broker network call attempt only"}`
  ];

  const implementationReadiness = buildPaperBrokerNetworkCallImplementationPatch({
    env,
    argv: implementationArgv,
    now,
    runsDir
  });

  const presence = envPresence(env);
  const blockers = [];

  if (implementationReadiness.ok !== true) blockers.push("network_call_implementation_not_ok");
  if (implementationReadiness.readyForSinglePaperNetworkAttempt !== true) {
    blockers.push("network_call_implementation_not_ready");
  }
  if ((implementationReadiness.blockers ?? []).length > 0) {
    blockers.push("network_call_implementation_blockers_present");
  }

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 40) blockers.push("runtime_preflight_reason_required");
  if (preflightApproval !== REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE) {
    blockers.push("exact_runtime_preflight_approval_phrase_required");
  }

  if (preflightOnly !== true) blockers.push("preflight_only_flag_required");
  if (noNetworkAttempt !== true) blockers.push("no_network_attempt_flag_required");
  if (noOrderAttempt !== true) blockers.push("no_order_attempt_flag_required");
  if (noBrokerContact !== true) blockers.push("no_broker_contact_flag_required");

  if (!presence.alpacaPaperTradingBaseUrlPresent) blockers.push("alpaca_paper_trading_base_url_missing");
  if (!presence.alpacaPaperRoutePathPresent) blockers.push("alpaca_paper_route_path_missing");
  if (!presence.alpacaApiKeyPresent) blockers.push("alpaca_api_key_missing");
  if (!presence.alpacaApiSecretPresent) blockers.push("alpaca_api_secret_missing");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (implementationReadiness.brokerAdapterCallAttempted !== false) blockers.push("implementation_broker_adapter_call_attempted");
  if (implementationReadiness.brokerContactAttempted !== false) blockers.push("implementation_broker_contact_attempted");
  if (implementationReadiness.orderSubmitAttempted !== false) blockers.push("implementation_order_submit_attempted");
  if (implementationReadiness.orderSubmitted !== false) blockers.push("implementation_order_submitted");
  if (implementationReadiness.accountMutationAttempted !== false) blockers.push("implementation_account_mutation_attempted");

  const runtimeEnvironmentReady = blockers.length === 0;

  return {
    ok: true,
    version: PAPER_BROKER_RUNTIME_ENVIRONMENT_PREFLIGHT_VERSION,
    ts: now.toISOString(),
    status: runtimeEnvironmentReady ? "runtime_environment_ready" : "blocked",
    runtimeEnvironmentReady,
    preflightOnly: true,
    networkAttempted: false,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: params,
    approval: {
      by: by || null,
      reason: reason || null,
      requiredPreflightApprovalPhrase: REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE,
      preflightApprovalPhraseMatched:
        preflightApproval === REQUIRED_PAPER_BROKER_RUNTIME_PREFLIGHT_APPROVAL_PHRASE
    },
    flags: {
      preflightOnly,
      noNetworkAttempt,
      noOrderAttempt,
      noBrokerContact
    },
    environment: presence,
    implementationReadiness: {
      version: implementationReadiness.version,
      status: implementationReadiness.status,
      readyForSinglePaperNetworkAttempt:
        implementationReadiness.readyForSinglePaperNetworkAttempt,
      approvalRecordFound: implementationReadiness.approval?.approvalRecordFound === true,
      approvalRecordFile: implementationReadiness.approval?.approvalRecordFile ?? null,
      priorAttempt: implementationReadiness.priorAttempt,
      session: implementationReadiness.session,
      brokerTarget: implementationReadiness.brokerTarget,
      credentialState: implementationReadiness.credentialState,
      blockers: implementationReadiness.blockers ?? []
    },
    safety: {
      preflightOnly: true,
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      networkAttempted: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: runtimeEnvironmentReady
      ? "Runtime environment is ready for the final separate one-shot paper broker attempt command. This preflight did not contact broker."
      : "Resolve blockers before the first one-shot paper broker network attempt."
  };
}

export function writePaperBrokerRuntimeEnvironmentPreflightReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.runtimeEnvironmentReady ? "ready" : "blocked";
  const file = join(runsDir, `paper_broker_runtime_environment_preflight_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
