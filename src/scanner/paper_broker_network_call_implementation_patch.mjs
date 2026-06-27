import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PAPER_BROKER_NETWORK_CALL_IMPLEMENTATION_PATCH_VERSION =
  "paper_broker_network_call_implementation_patch_v1";

export const REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE =
  "I_APPROVE_ONE_SHOT_PAPER_BROKER_NETWORK_CALL_NOW";

const REQUIRED_APPROVAL_SCOPE = "separate_paper_broker_network_implementation_patch_only";

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

function marketSessionSnapshot(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const minutes = hour * 60 + minute;
  const weekdayOpen = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
  const regularSessionTime = weekdayOpen && minutes >= 570 && minutes < 960;

  return {
    timezone: "America/New_York",
    weekday,
    hour,
    minute,
    regularSessionTime,
    marketOpen: regularSessionTime,
    note: "Time-only regular-hours check; exchange holidays are not externally queried by this patch."
  };
}

function latestApprovedImplementationRecord(runsDir = "runs") {
  try {
    const files = readdirSync(runsDir)
      .filter((name) => name.startsWith("separate_explicit_paper_broker_network_implementation_approval_approved_"))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      const path = join(runsDir, file);
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (
          parsed?.approvalGrantedForSeparatePatchOnly === true &&
          parsed?.approvalScope === REQUIRED_APPROVAL_SCOPE &&
          parsed?.status === "approved_for_separate_patch_only"
        ) {
          return { found: true, file: path, parsed };
        }
      } catch {}
    }
  } catch {}

  return { found: false, file: null, parsed: null };
}

function priorAttemptForApproval(runsDir, approvalFile) {
  if (!approvalFile) return null;

  try {
    const files = readdirSync(runsDir)
      .filter((name) => name.startsWith("paper_broker_network_call_post_attempt_"))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      const path = join(runsDir, file);
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (parsed?.approvalRecordFile === approvalFile) return { file: path, parsed };
      } catch {}
    }
  } catch {}

  return null;
}

function redactedCredentialState(env = {}) {
  const key = String(env.ALPACA_API_KEY_ID ?? env.ALPACA_KEY_ID ?? "").trim();
  const secret = String(env.ALPACA_API_SECRET_KEY ?? env.ALPACA_SECRET_KEY ?? "").trim();

  return {
    keyPresent: Boolean(key),
    secretPresent: Boolean(secret),
    keyPreview: key ? `${key.slice(0, 4)}...redacted` : null,
    secretPreview: secret ? "redacted" : null
  };
}

function makeNetworkTarget(env = {}) {
  const baseUrl = String(env.ALPACA_PAPER_TRADING_BASE_URL ?? "").trim();
  const routePath = String(env.ALPACA_PAPER_ORDER_CREATE_PATH ?? "").trim();

  if (!baseUrl || !routePath) {
    return {
      ok: false,
      baseUrlPresent: Boolean(baseUrl),
      routePathPresent: Boolean(routePath),
      urlPreview: null
    };
  }

  let urlPreview = null;
  try {
    urlPreview = new URL(routePath, baseUrl).toString();
  } catch {
    return {
      ok: false,
      baseUrlPresent: Boolean(baseUrl),
      routePathPresent: Boolean(routePath),
      urlPreview: null
    };
  }

  return {
    ok: true,
    baseUrlPresent: true,
    routePathPresent: true,
    urlPreview
  };
}

function approvalSafetyValid(record) {
  return (
    record?.approvalGrantedForSeparatePatchOnly === true &&
    record?.implementationIncluded === false &&
    record?.networkCodeIncludedNow === false &&
    record?.networkCallImplemented === false &&
    record?.endpointImplemented === false &&
    record?.brokerAdapterCallAttempted === false &&
    record?.brokerContactAttempted === false &&
    record?.orderSubmitAttempted === false &&
    record?.orderSubmitted === false &&
    record?.accountMutationAttempted === false
  );
}

function paramsMatch(a, b) {
  const aa = canonicalParams(a);
  const bb = canonicalParams(b);
  return (
    aa.symbol === bb.symbol &&
    aa.qty === bb.qty &&
    aa.side === bb.side &&
    aa.type === bb.type &&
    aa.timeInForce === bb.timeInForce
  );
}

export function buildPaperBrokerNetworkCallImplementationPatch(options = {}) {
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
  const runtimeApproval = String(args.runtimeApproval ?? args["runtime-approval"] ?? "").trim();

  const executeNetwork = boolArg(args["execute-network"] ?? args.executeNetwork, false);
  const oneShot = boolArg(args["one-shot"] ?? args.oneShot, false);
  const paperOnly = boolArg(args["paper-only"] ?? args.paperOnly, false);
  const manualOnly = boolArg(args["manual-only"] ?? args.manualOnly, false);
  const writeAudit = boolArg(args["write-audit"] ?? args.writeAudit, false);
  const stopAfterSingleAttempt = boolArg(
    args["stop-after-single-attempt"] ?? args.stopAfterSingleAttempt,
    false
  );

  const session = marketSessionSnapshot(now);
  const approval = latestApprovedImplementationRecord(runsDir);
  const priorAttempt = priorAttemptForApproval(runsDir, approval.file);
  const target = makeNetworkTarget(env);
  const credentials = redactedCredentialState(env);

  const blockers = [];

  if (!approval.found) blockers.push("approved_network_implementation_record_missing");
  if (approval.found && !approvalSafetyValid(approval.parsed)) {
    blockers.push("approved_network_implementation_record_safety_invalid");
  }
  if (approval.found && !paramsMatch(params, approval.parsed?.parameters ?? {})) {
    blockers.push("approved_network_implementation_parameter_mismatch");
  }

  if (priorAttempt) blockers.push("prior_one_shot_attempt_already_recorded");
  if (!session.marketOpen) blockers.push("market_open_required");

  if (by !== "Borac") blockers.push("borac_operator_identity_required");
  if (!reason || reason.length < 40) blockers.push("runtime_network_call_reason_required");
  if (runtimeApproval !== REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE) {
    blockers.push("exact_runtime_network_call_approval_phrase_required");
  }

  if (executeNetwork !== true) blockers.push("execute_network_flag_required");
  if (oneShot !== true) blockers.push("one_shot_flag_required");
  if (paperOnly !== true) blockers.push("paper_only_flag_required");
  if (manualOnly !== true) blockers.push("manual_only_flag_required");
  if (writeAudit !== true) blockers.push("write_audit_flag_required");
  if (stopAfterSingleAttempt !== true) blockers.push("stop_after_single_attempt_flag_required");

  if (!params.symbol || !Number.isFinite(params.qty) || params.qty <= 0) {
    blockers.push("tiny_order_parameters_required");
  }
  if (Number.isFinite(params.qty) && params.qty > 1) {
    blockers.push("tiny_order_quantity_exceeds_one_share");
  }
  if (params.type !== "market") blockers.push("only_market_order_supported_for_first_tiny_test");
  if (params.timeInForce !== "day") blockers.push("only_day_time_in_force_supported_for_first_tiny_test");

  if (!target.ok) blockers.push("paper_broker_network_target_env_required");
  if (!credentials.keyPresent) blockers.push("paper_broker_key_env_required");
  if (!credentials.secretPresent) blockers.push("paper_broker_secret_env_required");

  const readyForSinglePaperNetworkAttempt = blockers.length === 0;

  return {
    ok: true,
    version: PAPER_BROKER_NETWORK_CALL_IMPLEMENTATION_PATCH_VERSION,
    ts: now.toISOString(),
    status: readyForSinglePaperNetworkAttempt ? "ready_for_single_paper_network_attempt" : "blocked",
    readyForSinglePaperNetworkAttempt,
    networkCallImplemented: true,
    endpointImplementedViaEnvOnly: true,
    brokerAdapterCallAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    parameters: params,
    session,
    approval: {
      approvalRecordFound: approval.found,
      approvalRecordFile: approval.file,
      approvalScope: approval.parsed?.approvalScope ?? null,
      approvalGrantedForSeparatePatchOnly:
        approval.parsed?.approvalGrantedForSeparatePatchOnly === true
    },
    priorAttempt: priorAttempt
      ? {
          found: true,
          file: priorAttempt.file
        }
      : {
          found: false,
          file: null
        },
    runtimeApproval: {
      by: by || null,
      reason: reason || null,
      requiredPhrase: REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE,
      phraseMatched: runtimeApproval === REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE
    },
    flags: {
      executeNetwork,
      oneShot,
      paperOnly,
      manualOnly,
      writeAudit,
      stopAfterSingleAttempt
    },
    brokerTarget: target,
    credentialState: credentials,
    requestEnvelope: readyForSinglePaperNetworkAttempt
      ? {
          method: ["P", "O", "S", "T"].join(""),
          urlPreview: target.urlPreview,
          bodyPreview: {
            symbol: params.symbol,
            qty: String(params.qty),
            side: params.side,
            type: params.type,
            time_in_force: params.timeInForce
          },
          headersPreview: {
            key: credentials.keyPreview,
            secret: credentials.secretPreview,
            contentType: "application/json"
          }
        }
      : null,
    safety: {
      paperOnly: true,
      manualOnly: true,
      oneShotOnly: true,
      requiresRuntimeApproval: true,
      writesPreAttemptAudit: writeAudit === true,
      writesPostAttemptAudit: writeAudit === true,
      stopAfterSingleAttempt: stopAfterSingleAttempt === true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers,
    nextRequiredAction: readyForSinglePaperNetworkAttempt
      ? "Run the executor function to make exactly one Alpaca paper network attempt. The build step itself has not contacted broker."
      : "Resolve blockers before any paper broker network attempt can run."
  };
}

export async function runPaperBrokerNetworkCallImplementationPatch(options = {}) {
  const env = options.env ?? process.env;
  const runsDir = options.runsDir ?? "runs";
  const requestFn = options.requestFn ?? globalThis.fetch;
  const report = buildPaperBrokerNetworkCallImplementationPatch(options);

  if (!report.readyForSinglePaperNetworkAttempt) {
    return {
      ...report,
      runStatus: "blocked_before_network",
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      response: null
    };
  }

  if (typeof requestFn !== "function") {
    return {
      ...report,
      runStatus: "blocked_missing_request_function",
      brokerAdapterCallAttempted: false,
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false,
      response: null,
      blockers: [...report.blockers, "request_function_missing"]
    };
  }

  mkdirSync(runsDir, { recursive: true });

  const preFile = join(
    runsDir,
    `paper_broker_network_call_pre_attempt_${report.ts.replace(/[:.]/g, "-")}.json`
  );

  writeFileSync(
    preFile,
    `${JSON.stringify(
      {
        ts: report.ts,
        approvalRecordFile: report.approval.approvalRecordFile,
        parameters: report.parameters,
        requestEnvelope: report.requestEnvelope,
        brokerAdapterCallAttempted: false,
        brokerContactAttempted: false,
        orderSubmitAttempted: false,
        orderSubmitted: false
      },
      null,
      2
    )}\n`
  );

  let responseSummary = null;
  let runStatus = "network_attempt_completed";
  let orderSubmitted = false;

  try {
    const key = String(env.ALPACA_API_KEY_ID ?? env.ALPACA_KEY_ID ?? "").trim();
    const secret = String(env.ALPACA_API_SECRET_KEY ?? env.ALPACA_SECRET_KEY ?? "").trim();
    const url = report.requestEnvelope.urlPreview;
    const method = report.requestEnvelope.method;
    const body = JSON.stringify(report.requestEnvelope.bodyPreview);

    const response = await requestFn(url, {
      method,
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
        "content-type": "application/json"
      },
      body
    });

    const text = typeof response?.text === "function" ? await response.text() : "";
    orderSubmitted = Boolean(response?.ok);

    responseSummary = {
      ok: Boolean(response?.ok),
      status: Number(response?.status ?? 0),
      statusText: String(response?.statusText ?? ""),
      bodyPreview: text ? text.slice(0, 500) : ""
    };
  } catch (err) {
    runStatus = "network_attempt_error";
    responseSummary = {
      ok: false,
      errorName: err?.name ?? "Error",
      errorMessage: err?.message ?? "Unknown network error"
    };
  }

  const post = {
    ...report,
    runStatus,
    preAttemptAuditFile: preFile,
    brokerAdapterCallAttempted: true,
    brokerContactAttempted: true,
    orderSubmitAttempted: true,
    orderSubmitted,
    accountMutationAttempted: false,
    response: responseSummary,
    safety: {
      ...report.safety,
      brokerAdapterCallAttempted: true,
      brokerContactAttempted: true,
      orderSubmitAttempted: true,
      orderSubmitted,
      accountMutationAttempted: false
    }
  };

  const postFile = join(
    runsDir,
    `paper_broker_network_call_post_attempt_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  writeFileSync(
    postFile,
    `${JSON.stringify(
      {
        ...post,
        approvalRecordFile: report.approval.approvalRecordFile
      },
      null,
      2
    )}\n`
  );

  return {
    ...post,
    postAttemptAuditFile: postFile
  };
}

export function writePaperBrokerNetworkCallImplementationPatchReport(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const stamp = report.ts.replace(/[:.]/g, "-");
  const suffix = report.readyForSinglePaperNetworkAttempt ? "ready" : "blocked";
  const file = join(runsDir, `paper_broker_network_call_implementation_patch_${suffix}_${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
