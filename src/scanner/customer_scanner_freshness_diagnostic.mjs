import fs from "node:fs";

export const VERSION = "customer_scanner_freshness_diagnostic_v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function iso(value) {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function fileMetadata(source) {
  if (!source || typeof source !== "string") return { path: null, exists: false, modifiedAt: null, sizeBytes: null };
  try {
    const stat = fs.statSync(source);
    return { path: source, exists: true, modifiedAt: stat.mtime.toISOString(), sizeBytes: stat.size };
  } catch {
    return { path: source, exists: false, modifiedAt: null, sizeBytes: null };
  }
}

export function buildCustomerScannerFreshnessDiagnostic({ nowMs = Date.now(), cacheDiagnostics = null, rankingRoot = {}, streamTelemetry = {} } = {}) {
  const latest = cacheDiagnostics?.latest ?? null;
  const candidates = list(latest?.candidates);
  const rankingBySymbol = new Map(list(rankingRoot?.rankings).map((row) => [String(row?.symbol ?? "").trim().toUpperCase(), row]).filter(([symbol]) => symbol));
  const rankingSourceAgeSec = finite(rankingRoot?.sourceAgeSec);
  const rankingMaxAgeSec = finite(rankingRoot?.maxAgeSec);
  const rankingStale = rankingRoot?.stale !== false;
  const sourceFile = fileMetadata(rankingRoot?.source ?? null);

  const candidateDiagnostics = candidates.slice(0, 100).map((candidate) => {
    const symbol = String(candidate?.symbol ?? "").trim().toUpperCase();
    const ranking = rankingBySymbol.get(symbol) ?? null;
    const quoteStale = candidate?.sourceStale === true;
    const rankingMissing = ranking === null;
    const staleReasons = [
      ...(quoteStale ? ["QUOTE_STALE"] : []),
      ...(rankingStale ? ["RANKINGS_STALE"] : []),
      ...(rankingMissing ? ["RANKING_MISSING"] : []),
    ];
    return {
      symbol,
      quoteSourceTs: iso(candidate?.sourceTs),
      quoteSourceAgeSec: finite(candidate?.sourceAgeSec),
      quoteMaxAgeSec: finite(candidate?.maxSourceAgeSec),
      quoteStale,
      rankingConnected: !rankingMissing,
      rankingSourceTs: iso(rankingRoot?.sourceTs),
      rankingSourceAgeSec,
      rankingMaxAgeSec,
      rankingStale,
      staleReasons,
      finalResultState: staleReasons.length > 0 ? "STALE_DATA" : String(candidate?.resultState ?? candidate?.decision ?? "NO_SETUP"),
    };
  });

  const staleReasonCounts = candidateDiagnostics.reduce((counts, row) => {
    for (const reason of row.staleReasons) counts[reason] = (counts[reason] ?? 0) + 1;
    return counts;
  }, {});

  return {
    ok: true,
    version: VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    marketClock: latest?.marketClock ?? null,
    sharedCache: {
      running: cacheDiagnostics?.running === true,
      scanCount: finite(cacheDiagnostics?.scanCount) ?? 0,
      lastError: cacheDiagnostics?.lastError ?? null,
      hasSnapshot: cacheDiagnostics?.hasSnapshot === true,
      generatedAt: iso(latest?.sharedCache?.generatedAt),
      clockCheckedAt: iso(latest?.sharedCache?.clockCheckedAt),
      candidateCount: finite(latest?.candidateCount) ?? candidates.length,
    },
    quoteFreshness: {
      thresholdSec: candidates.length > 0 ? finite(candidates[0]?.maxSourceAgeSec) : null,
      staleCount: candidateDiagnostics.filter((row) => row.quoteStale).length,
      candidateCount: candidateDiagnostics.length,
    },
    rankingFreshness: {
      source: rankingRoot?.source ?? null,
      sourceFile,
      sourceTs: iso(rankingRoot?.sourceTs),
      sourceAgeSec: rankingSourceAgeSec,
      maxAgeSec: rankingMaxAgeSec,
      stale: rankingStale,
      scannerHealth: rankingRoot?.scannerHealth ?? null,
      rankingCount: finite(rankingRoot?.count) ?? list(rankingRoot?.rankings).length,
      issues: list(rankingRoot?.issues),
    },
    stream: {
      connected: streamTelemetry?.streamConnected === true,
      stale: streamTelemetry?.streamStale === true,
      lastEventAgeSec: finite(streamTelemetry?.lastEventAgeSec),
      staleThresholdSec: finite(streamTelemetry?.staleThresholdSec),
      reconnectAttempts: finite(streamTelemetry?.reconnectAttempts),
    },
    staleReasonCounts,
    candidates: candidateDiagnostics,
    safety: {
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      automaticLearningAllowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    },
  };
}
