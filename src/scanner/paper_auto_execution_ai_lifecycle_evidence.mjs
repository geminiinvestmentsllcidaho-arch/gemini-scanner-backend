import fs from "node:fs";
import path from "node:path";
import { PaperAutoExecutionLifecycleStore } from "./paper_auto_execution_lifecycle_store.mjs";

export const VERSION = "paper_auto_execution_ai_lifecycle_evidence_v1";

const clean = (value, max = 96) => String(value ?? "").trim().slice(0, max);
const upper = (value) => clean(value, 24).toUpperCase() || null;
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const isoMs = (value) => {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) ? ms : null;
};
const boundedStrings = (values, max = 12) => Object.freeze(
  (Array.isArray(values) ? values : []).slice(0, max).map((v) => clean(v, 96)).filter(Boolean),
);

function strategyPhase(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.freeze({
    phase: clean(value.phase, 48) || null,
    recordedAt: value.recordedAt ?? null,
    snapshotObservedAt: value.snapshotObservedAt ?? null,
    decision: clean(value.decision, 48) || null,
    resultState: clean(value.resultState, 48) || null,
    blocked: value.blocked === true,
    blockers: boundedStrings(value.blockers),
    blockingFlags: boundedStrings(value.blockingFlags),
    staleReasons: boundedStrings(value.staleReasons),
    sourceStale: value.sourceStale === true,
    score: finite(value.score),
    readonlyPotentialScore: finite(value.readonlyPotentialScore),
    price: finite(value.price),
    rankingSetupScore: finite(value.rankingSetupScore),
    rankingConfidence: finite(value.rankingConfidence),
    rankingQuality: finite(value.rankingQuality),
    strategyAuthorized: value.strategyAuthorization?.authorized === true,
  });
}

function exitDecision(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.freeze({
    decision: clean(value.decision, 64) || null,
    reasonCodes: boundedStrings(value.reasonCodes),
    sourceFresh: value.sourceFresh === true,
    observedAt: value.observedAt ?? value.generatedAt ?? null,
  });
}

function lifecycleRow(lifecycle = {}) {
  const strategy = lifecycle?.scannerEvidence?.strategyEvidence ?? {};
  const reconciliationKinds = boundedStrings(
    (Array.isArray(lifecycle.reconciliation) ? lifecycle.reconciliation : []).map((row) => row?.kind),
    20,
  );
  return Object.freeze({
    symbol: upper(lifecycle.selectedSymbol),
    state: clean(lifecycle.state, 64) || null,
    createdAt: lifecycle.createdAt ?? null,
    updatedAt: lifecycle.updatedAt ?? null,
    enterBrokerFilledAt: lifecycle.enterBrokerFilledAt ?? null,
    exitBrokerFilledAt: lifecycle.exitBrokerFilledAt ?? null,
    filledQuantity: finite(lifecycle.filledQuantity),
    averageFillPrice: finite(lifecycle.averageFillPrice),
    exitReason: clean(lifecycle.exitReason, 96) || null,
    exitDecisionEvidence: exitDecision(lifecycle.exitDecisionEvidence),
    candidateSelection: strategyPhase(strategy.candidateSelection),
    enterRevalidation: strategyPhase(strategy.enterRevalidation),
    reconciliationKinds,
  });
}

function scaleRow(current = {}) {
  return Object.freeze({
    symbol: upper(current.symbol),
    action: clean(current.action, 48) || null,
    state: clean(current.state, 64) || null,
    actionSequence: finite(current.actionSequence),
    fromQuantity: finite(current.fromQuantity),
    targetQuantity: finite(current.targetQuantity),
    quantity: finite(current.quantity),
    observedFilledQuantity: finite(current.observedFilledQuantity),
    brokerOrderStatus: clean(current.brokerOrderStatus, 64) || null,
    failureReason: clean(current.failureReason, 96) || null,
    preparedAt: current.preparedAt ?? null,
    reconciledAt: current.reconciledAt ?? null,
    updatedAt: current.updatedAt ?? null,
  });
}

export function buildPaperAutoExecutionAiLifecycleEvidence(options = {}) {
  const runsDir = path.resolve(options.runsDir ?? "runs");
  const epochMs = isoMs(options.performanceEpochStartedAt);
  const maxLifecycleRecords = Math.max(1, Math.min(100, Number(options.maxLifecycleRecords ?? 50)));
  const maxScaleRecords = Math.max(1, Math.min(100, Number(options.maxScaleRecords ?? 50)));
  const lifecycleRows = [];
  const scaleRows = [];

  if (fs.existsSync(runsDir)) {
    for (const name of fs.readdirSync(runsDir)) {
      const file = path.join(runsDir, name);

      if (
        /^paper_auto_execution_[A-Za-z0-9._-]+\.json$/.test(name)
        && !name.endsWith(".scale_action.json")
        && name !== "paper_auto_execution_active_lifecycle_pointer.json"
        && name !== "paper_auto_execution_active_lifecycle.json"
      ) {
        try {
          const lifecycle = new PaperAutoExecutionLifecycleStore({ filePath: file }).load();
          const createdMs = isoMs(lifecycle?.createdAt);
          if (!lifecycle) continue;
          if (epochMs !== null && (createdMs === null || createdMs < epochMs)) continue;
          lifecycleRows.push(lifecycleRow(lifecycle));
        } catch {}
        continue;
      }

      if (/^paper_auto_execution_[A-Za-z0-9._-]+\.scale_action\.json$/.test(name)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
          const current = parsed?.current;
          const preparedMs = isoMs(current?.preparedAt ?? current?.updatedAt);
          if (!current) continue;
          if (epochMs !== null && (preparedMs === null || preparedMs < epochMs)) continue;
          scaleRows.push(scaleRow(current));
        } catch {}
      }
    }
  }

  lifecycleRows.sort((a, b) => String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? "")));
  scaleRows.sort((a, b) => String(b.updatedAt ?? b.preparedAt ?? "").localeCompare(String(a.updatedAt ?? a.preparedAt ?? "")));

  const lifecycles = Object.freeze(lifecycleRows.slice(0, maxLifecycleRecords));
  const scaleActions = Object.freeze(scaleRows.slice(0, maxScaleRecords));
  const lifecycleStateCounts = {};
  for (const row of lifecycles) {
    const key = row.state ?? "UNKNOWN";
    lifecycleStateCounts[key] = (lifecycleStateCounts[key] ?? 0) + 1;
  }

  return Object.freeze({
    version: VERSION,
    performanceEpochActive: epochMs !== null,
    performanceEpochStartedAt: epochMs !== null ? new Date(epochMs).toISOString() : null,
    lifecycleRecordCount: lifecycles.length,
    scaleActionRecordCount: scaleActions.length,
    lifecycleStateCounts: Object.freeze({ ...lifecycleStateCounts }),
    lifecycles,
    scaleActions,
    readOnly: true,
    paperOnly: true,
    historicalAndCurrentLifecycleEvidence: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({
  VERSION,
  buildPaperAutoExecutionAiLifecycleEvidence,
});
