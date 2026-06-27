import { previewPaperTradeIntentCreationFromPlan } from './paper_trade_intent_creation_runner.mjs';

export const PAPER_TRADE_INTENT_CREATION_RUNNER_PANEL_VERSION =
  'paper_trade_intent_creation_runner_panel_v1';

export function readPaperTradeIntentCreationRunnerPanel(options = {}) {
  const preview = previewPaperTradeIntentCreationFromPlan(options.plan, options);

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_RUNNER_PANEL_VERSION,
    runnerVersion: preview.version,
    monitorOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Intent Creation Runner',
    route: '/diagnostics/paper-trade-intent-creation-runner',
    refreshRoute: '/diagnostics/paper-trade-intent-creation-runner-panel',
    mode: preview.mode,
    status: preview.creation.status,
    severity: preview.creation.status === 'created' ? 'info' : 'blocked',
    intentWouldBeCreated: preview.intentWouldBeCreated,
    intentCreated: false,
    wroteRecord: false,
    plannerStatus: preview.plannerStatus,
    plannerReasons: preview.plannerReasons,
    summary: {
      creationStatus: preview.creation.status,
      reasonCount: preview.creation.reasonCount,
      reasons: preview.creation.reasons,
      symbol: preview.creation.normalized.symbol || null,
      action: preview.creation.normalized.action || null,
      entryPrice: preview.creation.normalized.entryPrice,
      intentWouldBeCreated: preview.intentWouldBeCreated,
      intentCreated: false,
      wroteRecord: false
    },
    metrics: {
      reasonCount: preview.creation.reasonCount,
      intentWouldBeCreated: preview.intentWouldBeCreated,
      intentCreated: false,
      wroteRecord: false
    },
    badges: [
      { label: 'Preview Only', value: true },
      { label: 'Monitor Only', value: true },
      { label: 'Ledger Write', value: false },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: preview.safety
  };
}
