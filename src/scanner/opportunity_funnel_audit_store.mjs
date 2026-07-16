import fs from "node:fs";
import path from "node:path";

export const VERSION = "opportunity_funnel_audit_store_v1";
export const DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH =
  path.resolve("runs/opportunity_funnel_audit.jsonl");

function clean(value, maxLength = 256) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function list(value, maxItems = 20, maxLength = 128) {
  return Object.freeze(
    (Array.isArray(value) ? value : [])
      .slice(0, maxItems)
      .map((item) => clean(item, maxLength))
      .filter(Boolean),
  );
}

export function buildOpportunityFunnelAuditRecord(input = {}, options = {}) {
  const now = options.now instanceof Date
    ? options.now
    : new Date(options.now ?? Date.now());

  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const decisionCounts = candidates.reduce((counts, candidate) => {
    const decision = clean(candidate?.decision, 32).toUpperCase() || "UNKNOWN";
    counts[decision] = (counts[decision] ?? 0) + 1;
    return counts;
  }, {});

  const record = {
    version: VERSION,
    eventAt: now.toISOString(),
    scanId: clean(input.scanId, 128) || `scan-${now.getTime()}`,
    scanner: clean(input.scanner, 64) || "alpaca_under_five_shared",
    sourceVersion: clean(input.sourceVersion, 128) || null,
    sourceStatus: clean(input.sourceStatus, 64) || "unknown",
    marketOpen: input.marketOpen === true,
    assetCount: finite(input.assetCount) ?? 0,
    snapshotCount: finite(input.snapshotCount) ?? 0,
    candidateCount: finite(input.candidateCount) ?? candidates.length,
    decisionCounts: Object.freeze({ ...decisionCounts }),
    candidates: Object.freeze(candidates.slice(0, 500).map((candidate) => Object.freeze({
      symbol: clean(candidate?.symbol, 20).toUpperCase(),
      price: finite(candidate?.price),
      changePct: finite(candidate?.changePct),
      spreadPct: finite(candidate?.spreadPct),
      dollarVolume: finite(candidate?.dollarVolume),
      readonlyPotentialScore: finite(candidate?.readonlyPotentialScore),
      decision: clean(candidate?.decision, 32).toUpperCase() || "UNKNOWN",
      resultState: clean(candidate?.resultState, 32).toUpperCase() || null,
      blockingFlags: list(candidate?.blockingFlags),
      potentialFlags: list(candidate?.readonlyPotentialFlags),
      staleReasons: list(candidate?.staleReasons),
      sourceStale: candidate?.sourceStale === true,
      rankingConnected: candidate?.rankingConnected === true,
      rankingSetupScore: finite(candidate?.rankingSetupScore),
      rankingConfidence: finite(candidate?.rankingConfidence),
      rankingQuality: finite(candidate?.rankingQuality),
    }))),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    localStoreOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  };

  return Object.freeze(record);
}

export function appendOpportunityFunnelAuditRecord(input = {}, options = {}) {
  const auditPath =
    clean(options.auditPath, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH;
  const record = buildOpportunityFunnelAuditRecord(input, options);

  fs.mkdirSync(path.dirname(auditPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(auditPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(auditPath, 0o600);

  return Object.freeze({
    ok: true,
    appended: true,
    record,
    auditPath,
  });
}

export function listOpportunityFunnelAuditRecords(options = {}) {
  const auditPath =
    clean(options.auditPath, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH;
  if (!fs.existsSync(auditPath)) return Object.freeze([]);

  const maxRecords = Math.max(1, Math.min(1000, Number(options.maxRecords) || 100));
  const records = fs.readFileSync(auditPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .slice(-maxRecords)
    .reverse()
    .map((record) => Object.freeze(record));

  return Object.freeze(records);
}

export default {
  VERSION,
  DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH,
  buildOpportunityFunnelAuditRecord,
  appendOpportunityFunnelAuditRecord,
  listOpportunityFunnelAuditRecords,
};
