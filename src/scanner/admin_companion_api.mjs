export const VERSION = "admin_companion_api_v1";

const clean = (value) => String(value ?? "").trim();

function incidentSummary(record, source) {
  const failureCodes = Array.isArray(record?.failureCodes)
    ? record.failureCodes.map(clean).filter(Boolean).slice(0, 20)
    : [];
  const status = clean(record?.reportStatus || record?.status || (record?.open === true ? "unhealthy" : ""));
  return Object.freeze({
    source,
    status: status || "unknown",
    open: record?.open === true,
    transition: clean(record?.transition) || null,
    alertKind: clean(record?.alertKind) || null,
    failureCodes: Object.freeze(failureCodes),
    lastObservedAt: clean(record?.lastObservedAt || record?.generatedAt) || null,
    lastAlertAt: clean(record?.lastAlertAt) || null,
  });
}

export function buildAdminCompanionStatus({
  generatedAt = new Date().toISOString(),
  systemHealth = {},
  tradingEngine = {},
  infrastructureIncident = null,
  opsAiIncident = null,
} = {}) {
  const processes = Array.isArray(systemHealth?.processes)
    ? systemHealth.processes.map((row) => Object.freeze({
        name: clean(row?.name),
        status: clean(row?.status) || "unknown",
        cpu: Number.isFinite(Number(row?.cpu)) ? Number(row.cpu) : null,
        memoryBytes: Number.isFinite(Number(row?.mem)) ? Number(row.mem) : null,
      }))
    : [];

  const recentErrors = Array.isArray(systemHealth?.errors)
    ? systemHealth.errors.slice(-20).map((row) => Object.freeze({
        source: clean(row?.source) || "unknown",
        message: clean(row?.line).slice(0, 800),
      }))
    : [];

  const incidents = Object.freeze({
    infrastructure: incidentSummary(infrastructureIncident, "infrastructure"),
    opsAi: incidentSummary(opsAiIncident, "ops_ai"),
  });

  const degraded =
    incidents.infrastructure.open ||
    incidents.opsAi.open ||
    processes.some((row) => row.status !== "online" && row.name !== "gemini-dry-scanner");

  return Object.freeze({
    version: VERSION,
    generatedAt,
    status: degraded ? "degraded" : "ok",
    readOnly: true,
    adminOnly: true,
    clientPurpose: "shared_android_windows_admin_companion",
    host: Object.freeze({
      uptimeSec: Number.isFinite(Number(systemHealth?.host?.uptimeSec)) ? Number(systemHealth.host.uptimeSec) : null,
      memoryPct: Number.isFinite(Number(systemHealth?.host?.memoryPct)) ? Number(systemHealth.host.memoryPct) : null,
      diskPct: Number.isFinite(Number(systemHealth?.host?.diskPct)) ? Number(systemHealth.host.diskPct) : null,
      load: Number.isFinite(Number(systemHealth?.host?.load)) ? Number(systemHealth.host.load) : null,
    }),
    latency: Object.freeze({
      healthMs: Number.isFinite(Number(systemHealth?.latency?.health?.ms)) ? Number(systemHealth.latency.health.ms) : null,
      readinessMs: Number.isFinite(Number(systemHealth?.latency?.readiness?.ms)) ? Number(systemHealth.latency.readiness.ms) : null,
    }),
    processes: Object.freeze(processes),
    errors: Object.freeze(recentErrors),
    incidents,
    trading: Object.freeze({
      activeStoredOrders: Number.isFinite(Number(tradingEngine?.orderEvidence?.activeStoredCount))
        ? Number(tradingEngine.orderEvidence.activeStoredCount)
        : null,
      latestOrderStatus: clean(tradingEngine?.orderEvidence?.latestStatus) || null,
      latestOrderSymbol: clean(tradingEngine?.orderEvidence?.order?.symbol) || null,
      alpacaReadAccessEnabled: tradingEngine?.brokerage?.alpacaReadAccessEnabled === true,
      lastStoredBrokerHttpStatus: Number.isFinite(Number(tradingEngine?.brokerage?.lastStoredResponseStatus))
        ? Number(tradingEngine.brokerage.lastStoredResponseStatus)
        : null,
      submitToFillMs: Number.isFinite(Number(tradingEngine?.execution?.submitToFillMs))
        ? Number(tradingEngine.execution.submitToFillMs)
        : null,
    }),
    capabilities: Object.freeze({
      brokerContactAllowed: false,
      accountMutationAllowed: false,
      orderPlacementAllowed: false,
      orderCancellationAllowed: false,
      liveTradingAllowed: false,
    }),
  });
}

export default { VERSION, buildAdminCompanionStatus };
