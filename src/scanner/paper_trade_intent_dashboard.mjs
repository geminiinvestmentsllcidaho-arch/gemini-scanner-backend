import { getPaperTradeIntentPlan } from "./paper_trade_intent_planner.mjs";

const PANEL_VERSION = "paper_trade_intent_dashboard_v1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePlan(plan = {}) {
  const blockReasons = [
    ...asArray(plan.blockReasons),
    ...asArray(plan.reasons),
    ...asArray(plan.readinessGate?.blockReasons),
    ...asArray(plan.readinessGate?.reasons)
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  const readinessGateStatus =
    plan.readinessGateStatus ??
    plan.readiness_gate_status ??
    plan.readinessGate?.status ??
    plan.readinessGate?.readinessGateStatus ??
    (blockReasons.includes("readiness_gate_blocked") ? "blocked" : null);

  const canCreateIntent = plan.canCreateIntent === true;

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
