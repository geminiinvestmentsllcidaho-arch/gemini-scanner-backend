import * as plannerModule from "./paper_trade_intent_planner.mjs";

const PANEL_VERSION = "paper_trade_intent_dashboard_v1";

function resolvePlanner() {
  const preferred = [
    "buildPaperTradeIntentPlan",
    "buildPaperTradeIntentPlanner",
    "planPaperTradeIntent",
    "createPaperTradeIntentPlan",
    "default"
  ];

  for (const name of preferred) {
    if (typeof plannerModule[name] === "function") return plannerModule[name];
  }

  for (const [name, value] of Object.entries(plannerModule)) {
    if (
      typeof value === "function" &&
      /paper/i.test(name) &&
      /intent/i.test(name) &&
      /(plan|planner|build|create)/i.test(name)
    ) {
      return value;
    }
  }

  throw new Error("No compatible paper trade intent planner export found.");
}

function normalizePlan(plan = {}) {
  const blockReasons = Array.isArray(plan.blockReasons)
    ? plan.blockReasons
    : Array.isArray(plan.reasons)
      ? plan.reasons
      : [];

  const canCreateIntent = plan.canCreateIntent === true;

  return {
    ok: plan.ok === true,
    readinessGateStatus: plan.readinessGateStatus ?? plan.readiness_gate_status ?? null,
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
  const planner = resolvePlanner();
  const plan = planner(input);
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
