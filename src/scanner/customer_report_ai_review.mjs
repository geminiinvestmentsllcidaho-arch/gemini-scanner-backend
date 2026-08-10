export const VERSION = "customer_report_ai_review_v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pct(value) {
  const number = finite(value);
  return number === null ? null : Number((number * 100).toFixed(2));
}

export function buildCustomerReportAiReviewInput(report = {}) {
  return Object.freeze({
    version: VERSION,
    period: report?.period ?? "unknown",
    status: report?.status ?? "unknown",
    stale: report?.stale === true,
    performance: Object.freeze({
      totalPl: finite(report?.performance?.totalPl),
      totalReturnPct: finite(report?.performance?.totalReturnPct),
      maxDrawdown: finite(report?.performance?.maxDrawdown),
      startingBalance: finite(report?.performance?.startingBalance),
      realizedPl: finite(report?.performance?.realizedPl),
      unrealizedPl: finite(report?.performance?.unrealizedPl),
    }),
    currentBrokerPositions: Object.freeze(
      (Array.isArray(report?.currentBrokerPositions) ? report.currentBrokerPositions : []).slice(0, 50).map((position) => Object.freeze({
        symbol: String(position?.symbol ?? "").trim().toUpperCase() || null,
        qty: finite(position?.qty),
        side: position?.side ?? null,
        averageEntryPrice: finite(position?.averageEntryPrice),
        currentPrice: finite(position?.currentPrice),
        marketValue: finite(position?.marketValue),
        unrealizedPl: finite(position?.unrealizedPl),
        unrealizedPlpc: finite(position?.unrealizedPlpc),
      }))
    ),
    trades: Object.freeze({
      totalTrades: finite(report?.trades?.totalTrades) ?? 0,
      completedRoundTrips: finite(report?.trades?.completedRoundTrips),
      positionsOpened: finite(report?.trades?.positionsOpened),
      fillEventsObserved: finite(report?.trades?.fillEventsObserved),
      partialCloseCount: finite(report?.trades?.partialCloseCount),
      breakevenTrades: finite(report?.trades?.breakevenTrades),
      winRatePct: finite(report?.trades?.winRatePct),
      averageGain: finite(report?.trades?.averageGain),
      averageLoss: finite(report?.trades?.averageLoss),
      averageHoldTimeMs: finite(report?.trades?.averageHoldTimeMs),
      averageRealizedPnlPerTrade: finite(report?.trades?.averageRealizedPnlPerTrade),
      lifecycleSourceAvailable: report?.trades?.lifecycleSourceAvailable === true,
      sourceIntentReplayAuditAvailable:
        report?.trades?.sourceIntentReplayAuditAvailable === true,
      historicalSimulatedOpenPositions: Object.freeze(
        (Array.isArray(report?.trades?.openPositions) ? report.trades.openPositions : []).slice(0, 50).map((position) => Object.freeze({
          symbol: String(position?.symbol ?? "").trim().toUpperCase() || null,
          qty: finite(position?.qty),
          avgEntryPrice: finite(position?.avgEntryPrice),
          costBasis: finite(position?.costBasis),
          openedAt: position?.openedAt ?? null,
          entryFillCount: finite(position?.entryFillCount),
        }))
      ),
      sourceIntentReplayAudit: Object.freeze({
        hasPossibleReplay:
          report?.trades?.sourceIntentReplayAudit?.hasPossibleReplay === true,
        possibleReplayCount:
          finite(report?.trades?.sourceIntentReplayAudit?.possibleReplayCount) ?? 0,
        affectedIntentIds: Object.freeze(
          (Array.isArray(report?.trades?.sourceIntentReplayAudit?.affectedIntentIds)
            ? report.trades.sourceIntentReplayAudit.affectedIntentIds
            : [])
            .slice(0, 25)
            .map((value) => String(value).slice(0, 128)),
        ),
        affectedTicketIds: Object.freeze(
          (Array.isArray(report?.trades?.sourceIntentReplayAudit?.affectedTicketIds)
            ? report.trades.sourceIntentReplayAudit.affectedTicketIds
            : [])
            .slice(0, 50)
            .map((value) => String(value).slice(0, 128)),
        ),
        reasonCodes: Object.freeze(
          (Array.isArray(report?.trades?.sourceIntentReplayAudit?.reasonCodes)
            ? report.trades.sourceIntentReplayAudit.reasonCodes
            : [])
            .slice(0, 12)
            .map((value) => String(value).slice(0, 64)),
        ),
        recordsMutated:
          report?.trades?.sourceIntentReplayAudit?.recordsMutated === true,
        positionsAdjusted:
          report?.trades?.sourceIntentReplayAudit?.positionsAdjusted === true,
        orderPlacement:
          report?.trades?.sourceIntentReplayAudit?.orderPlacement === true,
      }),
    }),
    scanner: Object.freeze({
      signalsGenerated: finite(report?.scanner?.signalsGenerated) ?? 0,
      enter: finite(report?.scanner?.enter) ?? 0,
      exit: finite(report?.scanner?.exit) ?? 0,
      wait: finite(report?.scanner?.wait) ?? 0,
      doNotEnter: finite(report?.scanner?.doNotEnter) ?? 0,
      blocked: finite(report?.scanner?.blocked) ?? 0,
      stale: finite(report?.scanner?.stale) ?? 0,
      averageConfidence: finite(report?.scanner?.averageConfidence),
      averagePotentialScore: finite(report?.scanner?.averagePotentialScore),
      profitableSignals: finite(report?.scanner?.profitableSignals) ?? 0,
      failedSignals: finite(report?.scanner?.failedSignals) ?? 0,
    }),
    activity: Object.freeze(
      (Array.isArray(report?.activity) ? report.activity : []).slice(0, 25).map((row) => Object.freeze({
        symbol: String(row?.symbol ?? "").trim().toUpperCase() || null,
        qty: finite(row?.qty),
        avgEntryPrice: finite(row?.avgEntryPrice),
        costBasis: finite(row?.costBasis),
        realizedPnl: finite(row?.realizedPnl),
        lastFillPrice: finite(row?.lastFillPrice),
        lastUpdatedAt: row?.lastUpdatedAt ?? null,
        fillCount: finite(row?.fillCount),
      }))
    ),
    largestWinners: Object.freeze(
      (Array.isArray(report?.largestWinners) ? report.largestWinners : []).slice(0, 5).map((row) => Object.freeze({
        symbol: String(row?.symbol ?? "").trim().toUpperCase() || null,
        realizedPnl: finite(row?.realizedPnl),
      }))
    ),
    largestLosers: Object.freeze(
      (Array.isArray(report?.largestLosers) ? report.largestLosers : []).slice(0, 5).map((row) => Object.freeze({
        symbol: String(row?.symbol ?? "").trim().toUpperCase() || null,
        realizedPnl: finite(row?.realizedPnl),
      }))
    ),
    equityCurve: Object.freeze(
      (Array.isArray(report?.equityCurve) ? report.equityCurve : []).slice(-50).map((row) => Object.freeze({
        timestamp: row?.timestamp ?? null,
        equity: finite(row?.equity),
      }))
    ),
    completeness: Object.freeze({
      paperRecordCount: finite(report?.paperRecordCount) ?? 0,
      sourceTs: report?.sourceTs ?? null,
      sourceAgeSec: finite(report?.sourceAgeSec),
      maxAgeSec: finite(report?.maxAgeSec),
      averageHoldTimeAvailable: report?.trades?.averageHoldTime !== null
        && report?.trades?.averageHoldTime !== undefined,
      activityCount: Array.isArray(report?.activity) ? report.activity.length : 0,
      equityPointCount: Array.isArray(report?.equityCurve) ? report.equityCurve.length : 0,
      equityAvailablePointCount: (Array.isArray(report?.equityCurve) ? report.equityCurve : [])
        .filter((row) => finite(row?.equity) !== null).length,
    }),
    dataSemantics: Object.freeze({
      currentBrokerPositions: "Current holdings fetched read-only from the connected Alpaca paper account. This is the only report field that represents current broker positions.",
      activity: report?.freshnessSource === "alpaca_paper_readonly_observation"
        ? "Legacy local paper position-snapshot activity is excluded from broker-backed reports."
        : "Historical local paper position-snapshot activity. These rows are not current broker holdings and may be stale or diverge from the connected Alpaca paper account.",
      historicalSimulatedOpenPositions: report?.freshnessSource === "alpaca_paper_readonly_observation"
        ? "Open long positions reconstructed from broker-confirmed Alpaca PAPER filled-order history. They are historical order-lifecycle evidence and must never be described as current Alpaca holdings."
        : "Positions reconstructed only from the local simulated fill ledger. They are historical/simulated evidence and must never be described as current Alpaca holdings.",
      lastFillPrice: "Execution price of the latest recorded fill; it is not a current market quote.",
      unrealizedPl: "Current paper-account mark-to-market P/L; it may differ from lastFillPrice without inconsistency.",
      totalTrades: report?.freshnessSource === "alpaca_paper_readonly_observation"
        ? "Count of completed long round trips reconstructed deterministically from broker-confirmed Alpaca PAPER filled-order history and attributed by close timestamp."
        : report?.trades?.lifecycleSourceAvailable === true
          ? "Count of completed long round trips reconstructed deterministically from the local simulated fill ledger and attributed by close timestamp."
          : "Legacy alias for tradesWithRealizedPnl. Compatibility count of symbol activity rows with a non-zero realized P/L delta during the report period; not fills, closed positions, or completed round trips.",
      tradesWithRealizedPnl: report?.freshnessSource === "alpaca_paper_readonly_observation"
        ? "Count of broker-confirmed completed Alpaca PAPER round trips with non-zero realized P/L during the report period."
        : "Snapshot-derived compatibility count of symbol activity rows with a non-zero realized P/L delta during the report period.",
      completedRoundTrips: report?.freshnessSource === "alpaca_paper_readonly_observation"
        ? "Long-only completed position lifecycles reconstructed from broker-confirmed Alpaca PAPER filled-order history. Open positions and partial exits are not counted as completed trades."
        : "Long-only completed position lifecycles reconstructed from ordered local simulated fills. Open positions and partial exits are not counted as completed trades.",
      winRatePct: "Winning completed trades divided by winning plus losing completed trades. Break-even trades are reported separately and excluded from the denominator.",
      fillCount: "Cumulative recorded executions for the symbol, including partial fills.",
      equityCurve: report?.freshnessSource === "alpaca_paper_readonly_observation"
        ? "Historical equity points are unavailable in broker-backed reports because order history does not establish an account equity curve."
        : "Built only from ledger endingEquity values; null means unavailable and must never be interpreted as zero.",
      scannerEvents: "Scanner-event evidence is independent from fill-ledger evidence and may be absent for legacy or external fills.",
      staleEvidence: "Stale report evidence limits conclusions and must be described as provisional.",
    }),
    safety: Object.freeze({
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      automaticLogicMutationAllowed: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    }),
  });
}

export function buildDeterministicLogicProposals(report = {}) {
  const input = buildCustomerReportAiReviewInput(report);
  const proposals = [];
  const s = input.scanner;
  const t = input.trades;
  const p = input.performance;

  if (input.stale || s.stale > 0) {
    proposals.push({
      id: "tighten_stale_data_gate",
      category: "data_quality",
      severity: "high",
      observation: "Report contains stale source data or stale scanner results.",
      proposal: "Keep stale candidates blocked and require fresh ranking plus quote timestamps before ENTER eligibility.",
      suggestedPatch: null,
    });
  }

  if (s.signalsGenerated >= 10 && s.blocked / s.signalsGenerated >= 0.4) {
    proposals.push({
      id: "inspect_block_rate",
      category: "signal_quality",
      severity: "medium",
      observation: `${pct(s.blocked / s.signalsGenerated)}% of generated signals were blocked.`,
      proposal: "Inspect the dominant block reasons before changing thresholds; do not loosen gates globally.",
      suggestedPatch: null,
    });
  }

  if (t.totalTrades >= 5 && finite(t.winRatePct) !== null && t.winRatePct < 40) {
    proposals.push({
      id: "raise_entry_quality_review",
      category: "entry_logic",
      severity: "high",
      observation: report?.freshnessSource === "alpaca_paper_readonly_observation"
        ? `Win rate is ${t.winRatePct}% across ${t.totalTrades} broker-confirmed Alpaca PAPER completed round trips.`
        : t.lifecycleSourceAvailable
          ? `Win rate is ${t.winRatePct}% across ${t.totalTrades} completed fill-ledger round trips.`
          : `Win rate is ${t.winRatePct}% across ${t.totalTrades} symbols with non-zero realized P/L changes.`,
      proposal: "Backtest a higher minimum composite confidence and quality threshold using historical paper results.",
      suggestedPatch: null,
    });
  }

  if (finite(t.averageGain) !== null && finite(t.averageLoss) !== null && Math.abs(t.averageLoss) > t.averageGain) {
    proposals.push({
      id: "loss_asymmetry_review",
      category: "exit_logic",
      severity: "high",
      observation: `Average loss magnitude (${Math.abs(t.averageLoss)}) exceeds average gain (${t.averageGain}).`,
      proposal: "Review exit timing, stop discipline, and confidence decay after adverse movement.",
      suggestedPatch: null,
    });
  }

  if (finite(p.maxDrawdown) !== null && finite(p.startingBalance) !== null && p.startingBalance > 0) {
    const drawdownPct = (p.maxDrawdown / p.startingBalance) * 100;
    if (drawdownPct >= 5) {
      proposals.push({
        id: "drawdown_risk_review",
        category: "risk_logic",
        severity: drawdownPct >= 10 ? "high" : "medium",
        observation: `Estimated drawdown is ${drawdownPct.toFixed(2)}% of starting balance.`,
        proposal: "Backtest lower maximum position sizing and stronger portfolio exposure caps.",
        suggestedPatch: null,
      });
    }
  }

  if (s.signalsGenerated >= 10 && finite(s.averageConfidence) !== null && s.averageConfidence < 0.6) {
    proposals.push({
      id: "confidence_floor_review",
      category: "ranking_logic",
      severity: "medium",
      observation: `Average signal confidence is ${s.averageConfidence}.`,
      proposal: "Test a higher confidence floor and compare signal count, win rate, and drawdown before approval.",
      suggestedPatch: null,
    });
  }

  if (proposals.length === 0) {
    proposals.push({
      id: "no_material_change",
      category: "observation",
      severity: "low",
      observation: "No deterministic review trigger crossed its minimum evidence threshold.",
      proposal: "Collect more paper-history data before changing scanner logic.",
      suggestedPatch: null,
    });
  }

  return Object.freeze({
    version: VERSION,
    generatedAt: report?.sourceTs ?? null,
    input,
    proposals: Object.freeze(proposals.map((item) => Object.freeze(item))),
    automaticLogicMutationAllowed: false,
    requiresBacktest: true,
    requiresOperatorApproval: false,
    readOnly: true,
    paperOnly: true,
  });
}

export default {
  VERSION,
  buildCustomerReportAiReviewInput,
  buildDeterministicLogicProposals,
};
