export const VERSION = "paper_trade_fill_source_intent_replay_audit_v1";
export const DEFAULT_REPLAY_WINDOW_MS = 5 * 60 * 1000;
export const REASON = "POSSIBLE_SOURCE_INTENT_REPLAY";

function clean(value, maxLength = 128) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestamp(record = {}) {
  return record?.createdAt ?? record?.filledAt ?? record?.timestamp ?? record?.updatedAt ?? null;
}

function normalize(record = {}, index = 0) {
  const sourceTicketId = clean(record?.sourceTicketId);
  const sourceIntentId = clean(record?.sourceIntentId);
  const symbol = clean(record?.symbol, 24).toUpperCase();
  const side = clean(record?.side, 16).toLowerCase();
  const qty = finite(record?.qty);
  const fillPrice = finite(record?.fillPrice);
  const timeMs = Date.parse(timestamp(record));

  if (
    !sourceTicketId
    || !sourceIntentId
    || !symbol
    || !["buy", "sell"].includes(side)
    || !(qty > 0)
    || !(fillPrice > 0)
    || !Number.isFinite(timeMs)
  ) {
    return null;
  }

  return Object.freeze({
    index,
    fillId: clean(record?.fillId) || null,
    sourceTicketId,
    sourceIntentId,
    symbol,
    side,
    qty,
    fillPrice,
    createdAt: new Date(timeMs).toISOString(),
    timeMs,
  });
}

export function auditPaperTradeFillSourceIntentReplays(options = {}) {
  const records = Array.isArray(options.fillRecords) ? options.fillRecords : [];
  const replayWindowMs = Number.isFinite(Number(options.replayWindowMs))
    ? Math.max(0, Number(options.replayWindowMs))
    : DEFAULT_REPLAY_WINDOW_MS;
  const normalized = records
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => a.timeMs - b.timeMs || a.index - b.index);

  const evidence = [];
  const groups = new Map();

  for (const fill of normalized) {
    const key = [
      fill.sourceIntentId,
      fill.symbol,
      fill.side,
      String(fill.qty),
      String(fill.fillPrice),
    ].join("|");
    const prior = groups.get(key) ?? [];

    for (const candidate of prior) {
      if (candidate.sourceTicketId === fill.sourceTicketId) continue;
      const separationMs = fill.timeMs - candidate.timeMs;
      if (separationMs < 0 || separationMs > replayWindowMs) continue;

      evidence.push(Object.freeze({
        reason: REASON,
        sourceIntentId: fill.sourceIntentId,
        symbol: fill.symbol,
        side: fill.side,
        qty: fill.qty,
        fillPrice: fill.fillPrice,
        firstFillId: candidate.fillId,
        secondFillId: fill.fillId,
        firstSourceTicketId: candidate.sourceTicketId,
        secondSourceTicketId: fill.sourceTicketId,
        firstCreatedAt: candidate.createdAt,
        secondCreatedAt: fill.createdAt,
        separationMs,
      }));
    }

    prior.push(fill);
    groups.set(key, prior);
  }

  const affectedTicketIds = [...new Set(
    evidence.flatMap((item) => [item.firstSourceTicketId, item.secondSourceTicketId]),
  )].sort();
  const affectedIntentIds = [...new Set(evidence.map((item) => item.sourceIntentId))].sort();
  const affectedSymbols = [...new Set(evidence.map((item) => item.symbol))].sort();

  return Object.freeze({
    version: VERSION,
    reason: REASON,
    replayWindowMs,
    sourceRecordCount: records.length,
    normalizedRecordCount: normalized.length,
    invalidOrIncompleteRecordCount: records.length - normalized.length,
    possibleReplayCount: evidence.length,
    hasPossibleReplay: evidence.length > 0,
    affectedTicketCount: affectedTicketIds.length,
    affectedTicketIds: Object.freeze(affectedTicketIds),
    affectedIntentCount: affectedIntentIds.length,
    affectedIntentIds: Object.freeze(affectedIntentIds),
    affectedSymbolCount: affectedSymbols.length,
    affectedSymbols: Object.freeze(affectedSymbols),
    evidence: Object.freeze(evidence),
    readOnly: true,
    paperOnly: true,
    recordsMutated: false,
    positionsAdjusted: false,
    brokerContact: false,
    orderPlacement: false,
    accountMutation: false,
  });
}

export default { VERSION, auditPaperTradeFillSourceIntentReplays };
