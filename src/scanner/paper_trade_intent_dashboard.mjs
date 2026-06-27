import { getPaperTradeIntentPlan } from "./paper_trade_intent_planner.mjs";

const PANEL_VERSION = "paper_trade_intent_dashboard_v1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

function hasEntryPrice(entry) {
  if (!entry || typeof entry !== "object") return false;
  return Number.isFinite(Number(entry.price ?? entry.entryPrice ?? entry.limitPrice));
}

function deriveBlockReasons(plan = {}) {
  const reasons = [
    ...asArray(plan.blockReasons),
    ...asArray(plan.reasons),
    ...asArray(plan.readinessGate?.blockReasons),
    ...asArray(plan.readinessGate?.reasons)
  ];

  const canCreateIntent = plan.canCreateIntent === true;
  const symbol = plan.symbol ?? plan.candidate?.symbol ?? plan.intent?.symbol ?? null;
  const side = plan.side ?? plan.action ?? plan.intent?.side ?? plan.intent?.action ?? null;
  const entry = plan.entry ?? plan.intent?.entry ?? null;

  if (!canCreateIntent) reasons.push("readiness_gate_blocked");
  if (!symbol) reasons.push("candidate_symbol_missing");
  if (!["buy", "sell"].includes(String(side ?? "").toLowerCase())) reasons.push("action_not_tradeable");
  if (!hasEntryPrice(entry)) reasons.push("entry_price_missing");

  return unique(reasons);
}

function normalizePlan(plan = {}) {
  const blockReasons = deriveBlockReasons(plan);
  const canCreateIntent = plan.canCreateIntent === true;

  const readinessGateStatus =
    plan.readinessGateStatus ??
    plan.readiness_gate_status ??
    plan.readinessGate?.status ??
    plan.readinessGate?.readinessGateStatus ??
    (canCreateIntent ? "passed" : "blocked");

  return {
    ok: plan.ok === true,
    readinessGateStatus,
    canCreateIntent,
    paperTradeIntentStatus: plan.paperTradeIntentStatus ?? (canCreateIntent ? "would_create" : "blocked"),
    blockReasons,
    intent: plan.intent ?? null,
    safety: {
      monitorOnly: plan.monitorOnly !== false,
      brokerContacted: plan.brokerContacted === true,
      orderPlacement: plan.orderPlacement ?? "disabled",
      liveTrading: plan.liveTrading ?? "disabled",
      autoTrading: plan.autoTrading ?? "disabled",
      brokerExecution: plan.brokerExecution ?? "disabled",
      accountMutation: plan.accountMutation ?? "disabled"
    }
  };
}

export function buildPaperTradeIntentDashboardPanel(input = {}) {
  const plan = getPaperTradeIntentPlan({
    baseDir: process.cwd(),
    write: false,
    input
  });

  const normalized = normalizePlan(plan);

  return {
    ok: true,
    version: PANEL_VERSION,
    monitorOnly: true,
    generatedAt: new Date().toISOString(),
    title: "Paper Trade Intent Dashboard Panel",
    summary: {
      readinessGateStatus: normalized.readinessGateStatus,
      paperTradeIntentStatus: normalized.paperTradeIntentStatus,
      canCreateIntent: normalized.canCreateIntent,
      intentWouldBeCreated: normalized.canCreateIntent === true && normalized.intent !== null,
      blocked: normalized.canCreateIntent !== true,
      blockReasonCount: normalized.blockReasons.length
    },
    readinessGate: {
      status: normalized.readinessGateStatus,
      canCreateIntent: normalized.canCreateIntent,
      blocked: normalized.canCreateIntent !== true
    },
    planner: {
      ok: normalized.ok,
      paperTradeIntentStatus: normalized.paperTradeIntentStatus,
      canCreateIntent: normalized.canCreateIntent,
      intent: normalized.intent
    },
    blockReasons: normalized.blockReasons,
    safety: normalized.safety,
    source: {
      planner: "src/scanner/paper_trade_intent_planner.mjs",
      route: "/diagnostics/paper-trade-intent-dashboard-panel"
    }
  };
}

export default buildPaperTradeIntentDashboardPanel;
