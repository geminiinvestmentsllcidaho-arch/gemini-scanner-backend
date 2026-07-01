import { spawnSync } from "node:child_process";

export const MARKET_CLOSED_SNAPSHOT_DIAGNOSTICS_VERSION =
  "market_closed_scanner_snapshot_diagnostics_v1";

export const MARKET_CLOSED_SNAPSHOT_PANEL_VERSION =
  "market_closed_scanner_snapshot_panel_v1";

const SNAPSHOT_SCRIPT = "scripts/market_closed_scanner_snapshot.mjs";

function safetyFlags() {
  return {
    monitorOnly: true,
    diagnosticsOnly: true,
    readOnly: true,
    reviewOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
  };
}

function pickJson(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function defaultRunner() {
  return spawnSync(process.execPath, [SNAPSHOT_SCRIPT], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 45_000,
    env: {
      ...process.env,
      GEMINISCANNER_DIAGNOSTICS_ONLY: "1",
      GEMINISCANNER_MARKET_CLOSED_SNAPSHOT_ROUTE: "1",
    },
  });
}

function deriveDisplayState(snapshot, runOk) {
  if (!runOk || !snapshot) return "ERROR";

  const text = JSON.stringify(snapshot).toLowerCase();
  const status = String(
    snapshot.status ??
      snapshot.snapshotStatus ??
      snapshot.scannerHealth ??
      snapshot.health ??
      "",
  ).toLowerCase();

  if (status.includes("blocked") || status.includes("no_go") || status.includes("fail")) {
    return "NO_GO";
  }

  if (
    status.includes("degraded") ||
    status.includes("caution") ||
    status.includes("stale") ||
    text.includes("market_closed") ||
    text.includes("off_hours") ||
    text.includes("off-hours") ||
    text.includes("stream_stale")
  ) {
    return "CAUTION";
  }

  return "OK";
}

function deriveSnapshotStatus(snapshot, runOk) {
  if (!runOk) return "snapshot_run_failed";
  if (!snapshot) return "snapshot_parse_failed";
  return (
    snapshot.status ??
    snapshot.snapshotStatus ??
    snapshot.scannerHealth ??
    snapshot.health ??
    "unknown"
  );
}

export function buildMarketClosedSnapshotDiagnostics(options = {}) {
  const run = options.runner ? options.runner() : defaultRunner();
  const stdout = String(run?.stdout ?? "");
  const stderr = String(run?.stderr ?? "");
  const exitCode = run?.status ?? null;
  const runOk = Number(exitCode ?? 0) === 0 && !run?.error;
  const snapshot = pickJson(stdout);
  const displayState = deriveDisplayState(snapshot, runOk);

  return {
    ok: true,
    version: MARKET_CLOSED_SNAPSHOT_DIAGNOSTICS_VERSION,
    routeType: "diagnostics_json",
    title: "Market Closed Scanner Snapshot Diagnostics",
    generatedAt: options.nowIso ?? new Date().toISOString(),
    ...safetyFlags(),
    scriptPath: SNAPSHOT_SCRIPT,
    runOk,
    snapshotParsed: Boolean(snapshot),
    snapshotStatus: deriveSnapshotStatus(snapshot, runOk),
    displayState,
    snapshot,
    diagnostics: {
      exitCode,
      signal: run?.signal ?? null,
      error: run?.error ? String(run.error.message ?? run.error) : null,
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: Buffer.byteLength(stderr),
      stderrPreview: stderr.slice(0, 1200),
    },
  };
}

export function buildMarketClosedSnapshotPanel(options = {}) {
  const diagnostics = options.diagnostics ?? buildMarketClosedSnapshotDiagnostics(options);
  const snapshot = diagnostics.snapshot ?? {};
  const displayState = diagnostics.displayState;

  return {
    ok: true,
    version: MARKET_CLOSED_SNAPSHOT_PANEL_VERSION,
    panelType: "operator_dashboard_card",
    title: "Market Closed Scanner Snapshot",
    generatedAt: diagnostics.generatedAt,
    status: diagnostics.snapshotStatus,
    displayState,
    severity:
      displayState === "OK"
        ? "info"
        : displayState === "CAUTION"
          ? "caution"
          : "blocked",
    ...safetyFlags(),
    readyForOrderPlacement: false,
    finalDecision: "READ_ONLY_NOT_ORDER_PLACEMENT",
    route: "/diagnostics/market-closed-scanner-snapshot",
    panelRoute: "/diagnostics/market-closed-scanner-snapshot-panel",
    snapshotParsed: diagnostics.snapshotParsed,
    runOk: diagnostics.runOk,
    metrics: {
      rankingCount:
        snapshot.rankingCount ??
        snapshot.rankingsCount ??
        (Array.isArray(snapshot.rankings) ? snapshot.rankings.length : null),
      marketSession:
        snapshot.session ??
        snapshot.marketSession ??
        snapshot.market?.session ??
        "unknown",
      scannerHealth:
        snapshot.scannerHealth ?? snapshot.health ?? snapshot.status ?? "unknown",
      stale:
        snapshot.stale ??  snapshot.streamStale ?? snapshot.freshness?.stale ?? null,
    },
    operatorSummary: [
      `Market-closed snapshot display state: ${displayState}.`,
      `Snapshot status: ${diagnostics.snapshotStatus}.`,
      "Monitor-only diagnostics. No broker, account, live-trading, auto-trading, or order-placement controls are enabled.",
    ],
  };
}

export default buildMarketClosedSnapshotDiagnostics;
