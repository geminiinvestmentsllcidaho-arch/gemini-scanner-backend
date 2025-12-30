/**
 * nextStep
 * ----------
 * Read-only, deterministic "what should happen next" planner.
 * NO market data
 * NO Alpaca
 * NO side effects
 *
 * Safe for Live Coaching Mode (LCM).
 */

export function nextStep({ dryRun = true } = {}) {
  if (!dryRun) {
    throw new Error('nextStep may only be called in dryRun mode');
  }

  return {
    stepId: 'validate-signal-flow',
    title: 'Validate signal flow',
    description:
      'Confirm that scanner inputs, rules, and outputs are flowing end-to-end without executing trades.',
    safe: true,
    reason:
      'System is in decision-assist mode. Next priority is confidence and observability, not execution.',
    suggestedActions: [
      'Review latest runlog entries',
      'Confirm market-hours gate behavior',
      'Verify symbol filters and price bounds'
    ],
    ts: new Date().toISOString()
  };
}
