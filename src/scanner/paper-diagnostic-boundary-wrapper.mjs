import { createDiagnosticAttemptGate } from './paper-diagnostic-attempt-gate.mjs';
import fs from 'node:fs';
import { buildPaperAutoOrderIdentity } from './paper_auto_execution_order_identity.mjs';

// Local integration seam. The existing boundary still validates and persists
// the lifecycle; the attempt budget is consumed only when it invokes its adapter.
export function createDiagnosticBoundaryWrapper({ boundary, readAccountIdentity, ...gateOptions }) {
  return async args => {
    if (args?.phase !== 'enter') throw Error('diagnostic_enter_only');
    const originalAdapter = args.submitPaperOrder;
    if (typeof originalAdapter !== 'function') throw Error('diagnostic_adapter_required');
    // Reject known exhausted/expired permits before the boundary can transition
    // a fresh candidate. Atomic reservation at the adapter still resolves races.
    if (fs.existsSync(gateOptions.reservationFile)) throw Error('diagnostic_attempt_already_reserved');
    const time = (gateOptions.now ?? Date.now)();
    const expiry = Date.parse(gateOptions.permit?.expiresAt);
    if (!Number.isFinite(time) || !Number.isFinite(expiry) || time >= expiry) throw Error('diagnostic_permit_expired');
    const expectedIdentity = 'alpaca-paper:feba75c3f7774226bd2c667b';
    if (await readAccountIdentity() !== expectedIdentity || gateOptions.permit?.accountIdentity !== expectedIdentity) {
      throw Error('diagnostic_account_mismatch');
    }
    const lifecycle = args.lifecycleStore?.load?.();
    const expectedOrder = buildPaperAutoOrderIdentity({ lifecycleId: lifecycle?.lifecycleId,
      phase: 'enter', symbol: lifecycle?.selectedSymbol, quantity: Number(args.quantity ?? 1), side: 'buy' });
    if (!gateOptions.permit?.experimentId || gateOptions.permit.lifecycleId !== expectedOrder.lifecycleId ||
        gateOptions.permit.clientOrderId !== expectedOrder.clientOrderId) throw Error('diagnostic_permit_correlation_mismatch');
    return boundary({ ...args, submitPaperOrder: async (order, context) => {
      const id = context?.deterministicIdentity;
      if (context?.phase !== 'enter' || context?.liveTradingAllowed !== false ||
          order?.paperOnly !== true || order?.side !== 'buy' ||
          !id || id.lifecycleId !== context.lifecycleId || id.clientOrderId !== order.clientOrderId ||
          id.symbol !== order.symbol || id.quantity !== order.qty || id.side !== order.side) {
        throw Error('diagnostic_adapter_identity_mismatch');
      }
      const gate = createDiagnosticAttemptGate({ ...gateOptions,
        submit: () => originalAdapter(order, context) });
      return gate({ phase: 'enter', lifecycleId: id.lifecycleId, clientOrderId: id.clientOrderId },
        await readAccountIdentity());
    } });
  };
}
