import crypto from "node:crypto";
import { fetchAlpacaPaperAccountReadonly } from "./alpaca_paper_account_readonly_fetch.mjs";
import { fetchAlpacaUnderFiveUniverseReadonly } from "./alpaca_under_five_universe_readonly.mjs";
import { classifyNextDayWatchSetup, classifyOvernightHoldAssessment, classifyPostMarketPositionRisk } from "./post_market_position_review.mjs";
import { buildPostMarketDailyQualityReview } from "./post_market_daily_quality_review.mjs";

export const VERSION = "post_market_readonly_worker_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const DEFAULT_EVIDENCE_SYMBOLS = Object.freeze(["AAPL", "MSFT", "NVDA", "SPY"]);
const MAX_EVIDENCE_SYMBOLS = 50;

function normalizeEvidenceSymbols(...sources) {
  const seen = new Set();
  const symbols = [];
  for (const source of sources) {
    const values = Array.isArray(source)
      ? source
      : String(source ?? "").split(",");
    for (const value of values) {
      const symbol = String(value ?? "").trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol) || seen.has(symbol)) continue;
      seen.add(symbol);
      symbols.push(symbol);
      if (symbols.length >= MAX_EVIDENCE_SYMBOLS) return symbols;
    }
  }
  return symbols;
}

function mergeMarketEvidence(positionEvidence, watchEvidence) {
  const merged = new Map();
  for (const candidate of Array.isArray(watchEvidence?.candidates) ? watchEvidence.candidates : []) {
    const symbol = String(candidate?.symbol ?? "").trim().toUpperCase();
    if (symbol) merged.set(symbol, candidate);
  }
  for (const candidate of Array.isArray(positionEvidence?.candidates) ? positionEvidence.candidates : []) {
    const symbol = String(candidate?.symbol ?? "").trim().toUpperCase();
    if (symbol) merged.set(symbol, candidate);
  }
  return Object.freeze({
    ok: positionEvidence?.ok === true && watchEvidence?.ok === true,
    status:
      positionEvidence?.status === "connected_readonly" && watchEvidence?.status === "connected_readonly"
        ? "connected_readonly"
        : positionEvidence?.status ?? watchEvidence?.status ?? "unavailable",
    candidates: Object.freeze([...merged.values()]),
  });
}

function candidateInput(candidate = {}, generatedAt) {
  return {
    ...candidate,
    closePrice: candidate.closePrice ?? candidate.currentPrice ?? candidate.price,
    afterHoursPrice: candidate.afterHoursPrice ?? candidate.currentPrice ?? candidate.price,
    afterHoursChangePct: candidate.afterHoursChangePct ?? candidate.changePct,
    dayChangePct: candidate.dayChangePct ?? candidate.changePct,
    sourceTimestamp: candidate.sourceTimestamp ?? candidate.sourceTs ?? null,
  };
}

function positionInput(position = {}, evidence = {}, generatedAt, portfolioValue) {
  const symbol = String(position.symbol ?? "").trim().toUpperCase();
  const match = (Array.isArray(evidence.candidates) ? evidence.candidates : [])
    .find((candidate) => String(candidate?.symbol ?? "").trim().toUpperCase() === symbol) ?? {};
  const marketValue = finite(position.marketValue);
  const allocationPct = marketValue !== null && finite(portfolioValue) > 0
    ? (marketValue / Number(portfolioValue)) * 100
    : null;
  return {
    ...candidateInput(match, generatedAt),
    ...position,
    symbol,
    allocationPct: position.allocationPct ?? allocationPct,
    spreadPct: position.spreadPct ?? match.spreadPct,
    afterHoursChangePct: position.afterHoursChangePct ?? match.afterHoursChangePct ?? match.changePct,
    relativeVolume: position.relativeVolume ?? position.rvol ?? match.relativeVolume ?? match.rvol,
    dollarVolume: position.dollarVolume ?? match.dollarVolume,
    catalystKnown: position.catalystKnown === true || match.catalystKnown === true,
    earningsWithinOneDay: position.earningsWithinOneDay === true || match.earningsWithinOneDay === true,
    halted: position.halted === true || match.halted === true,
    restricted: position.restricted === true || match.restricted === true,
    sourceTimestamp: position.sourceTimestamp ?? match.sourceTimestamp ?? match.sourceTs ?? null,
  };
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function failureResult(generatedAt, status, failureReason, apiStatus) {
  return Object.freeze({
    version: VERSION,
    generatedAt,
    status,
    success: false,
    failureReason,
    apiStatus: Object.freeze(apiStatus),
    positionReviews: Object.freeze([]),
    overnightReviews: Object.freeze([]),
    nextOpenWatchlist: Object.freeze([]),
    qualityReview: buildPostMarketDailyQualityReview([], { generatedAt }),
    duplicateSnapshot: false,
    fingerprint: null,
    immutableResult: true,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    humanReviewRequired: true,
    separateApprovalRequired: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export async function runPostMarketReadonlyWorkerCycle(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (Number.isNaN(now.getTime())) throw new TypeError("invalid_now");
  const generatedAt = now.toISOString();
  const fetchPaperAccount = options.fetchPaperAccount ?? fetchAlpacaPaperAccountReadonly;
  const fetchMarketEvidence = options.fetchMarketEvidence ?? fetchAlpacaUnderFiveUniverseReadonly;
  const maxFreshSec = Math.max(60, Number(options.maxFreshSec) || 900);

  let paperAccount;
  let marketEvidence;
  try {
    paperAccount = await fetchPaperAccount(options.paperAccountOptions ?? {});
    const positionSymbols = normalizeEvidenceSymbols(
      (Array.isArray(paperAccount?.positions) ? paperAccount.positions : [])
        .map((position) => position?.symbol),
    );
    const configuredSymbols = normalizeEvidenceSymbols(
      options.marketEvidenceOptions?.symbols
      ?? options.evidenceSymbols
      ?? options.env?.ALPACA_SYMBOLS
      ?? process.env.ALPACA_SYMBOLS,
    );
    const watchSymbols = configuredSymbols.length
      ? configuredSymbols
      : positionSymbols.length
        ? []
        : [...DEFAULT_EVIDENCE_SYMBOLS];
    const sharedOptions = {
      ...(options.marketEvidenceOptions ?? {}),
      nowMs: now.getTime(),
      maxSourceAgeSec: maxFreshSec,
    };
    delete sharedOptions.symbols;

    const positionEvidence = positionSymbols.length
      ? await fetchMarketEvidence({
          ...sharedOptions,
          minPrice: 0,
          maxPrice: Number.POSITIVE_INFINITY,
          minDailyVolume: 0,
          symbols: positionSymbols,
          maxAssets: positionSymbols.length,
        })
      : { ok: true, status: "connected_readonly", candidates: [] };

    const watchEvidence = watchSymbols.length
      ? await fetchMarketEvidence({
          ...sharedOptions,
          symbols: watchSymbols,
          maxAssets: watchSymbols.length,
        })
      : { ok: true, status: "connected_readonly", candidates: [] };

    marketEvidence = mergeMarketEvidence(positionEvidence, watchEvidence);
  } catch (error) {
    return failureResult(generatedAt, "source_fetch_failed_closed", String(error?.code ?? error?.message ?? "SOURCE_FETCH_FAILED").slice(0, 160), { paperAccount: "exception", marketEvidence: "exception" });
  }

  const accountReady = paperAccount?.status === "connected_readonly";
  const evidenceReady = marketEvidence?.ok === true && !["fetch_unavailable", "asset_fetch_failed", "snapshot_fetch_failed"].includes(marketEvidence?.status);
  if (!accountReady || !evidenceReady) {
    return failureResult(generatedAt, "source_unavailable_fail_closed", !accountReady ? `paper_account_${paperAccount?.status ?? "unavailable"}` : `market_evidence_${marketEvidence?.status ?? "unavailable"}`, { paperAccount: paperAccount?.status ?? "unavailable", marketEvidence: marketEvidence?.status ?? "unavailable" });
  }

  const positions = Array.isArray(paperAccount.positions) ? paperAccount.positions : [];
  const candidates = Array.isArray(marketEvidence.candidates) ? marketEvidence.candidates : [];
  const portfolioValue = paperAccount?.account?.portfolioValue ?? paperAccount?.account?.equity;
  const normalizedPositions = positions.map((position) => positionInput(position, marketEvidence, generatedAt, portfolioValue));
  const positionReviews = normalizedPositions.map((position) => classifyPostMarketPositionRisk(position, { now, maxFreshSec }));
  const overnightReviews = normalizedPositions.map((position) => classifyOvernightHoldAssessment(position, { now, maxFreshSec }));
  const nextOpenWatchlist = candidates.map((candidate) => classifyNextDayWatchSetup(candidateInput(candidate, generatedAt), { now, maxFreshSec }));

  const overnightBySymbol = new Map(overnightReviews.map((row) => [row.symbol, row]));
  const watchBySymbol = new Map(nextOpenWatchlist.map((row) => [row.symbol, row]));
  const symbols = new Set([...positionReviews.map((row) => row.symbol), ...nextOpenWatchlist.map((row) => row.symbol)].filter(Boolean));
  const qualityRows = [...symbols].map((symbol) => {
    const risk = positionReviews.find((row) => row.symbol === symbol);
    const overnight = overnightBySymbol.get(symbol);
    const watch = watchBySymbol.get(symbol);
    const flags = [...new Set([...(risk?.flags ?? []), ...(overnight?.flags ?? []), ...(watch?.flags ?? [])])];
    return {
      symbol,
      riskState: risk?.state ?? null,
      overnightState: overnight?.state ?? null,
      nextDayState: watch?.state ?? null,
      sourceTimestamp: risk?.sourceTimestamp ?? watch?.sourceTimestamp ?? generatedAt,
      sourceStale: flags.includes("SOURCE_STALE"),
      sourceObservable: !flags.some((flag) => flag === "SOURCE_STALE" || String(flag).endsWith("_UNAVAILABLE")),
      flags,
    };
  });

  const qualityReview = buildPostMarketDailyQualityReview(qualityRows, { generatedAt });
  const resultFingerprint = fingerprint({
    accountStatus: paperAccount.status,
    evidenceStatus: marketEvidence.status,
    positionReviews,
    overnightReviews,
    nextOpenWatchlist,
    proposalCount: qualityReview?.proposalReport?.proposalCount ?? 0,
  });

  return Object.freeze({
    version: VERSION,
    generatedAt,
    status: "completed_readonly",
    success: true,
    failureReason: null,
    apiStatus: Object.freeze({ paperAccount: paperAccount.status, marketEvidence: marketEvidence.status }),
    sourceFreshness: Object.freeze({
      maxFreshSec,
      stalePositionCount: positionReviews.filter((row) => row.state === "DATA_STALE").length,
      staleWatchCount: nextOpenWatchlist.filter((row) => row.flags.includes("SOURCE_STALE")).length,
    }),
    positionReviews: Object.freeze(positionReviews),
    overnightReviews: Object.freeze(overnightReviews),
    nextOpenWatchlist: Object.freeze(nextOpenWatchlist),
    qualityReview,
    duplicateSnapshot: Boolean(options.previousFingerprint) && options.previousFingerprint === resultFingerprint,
    fingerprint: resultFingerprint,
    immutableResult: true,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    humanReviewRequired: true,
    separateApprovalRequired: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({ VERSION, runPostMarketReadonlyWorkerCycle });
