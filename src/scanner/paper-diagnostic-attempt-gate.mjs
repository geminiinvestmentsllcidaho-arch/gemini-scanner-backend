import fs from 'node:fs';

// Local prototype only: compose around the existing ENTER submission boundary.
// The reservation is never removed, including on exceptions or ambiguous results.
export function createDiagnosticAttemptGate({ reservationFile, permit, now = Date.now, submit }) {
  const identity = 'alpaca-paper:feba75c3f7774226bd2c667b';
  return async function guardedSubmit(args, observedIdentity) {
    const time = now();
    if (args?.phase !== 'enter') throw Error('diagnostic_enter_only');
    if (observedIdentity !== identity || permit?.accountIdentity !== identity) throw Error('diagnostic_account_mismatch');
    if (!Number.isFinite(time) || !Number.isFinite(Date.parse(permit?.expiresAt)) || time >= Date.parse(permit.expiresAt)) throw Error('diagnostic_permit_expired');
    if (!permit?.experimentId || !permit?.lifecycleId || !permit?.clientOrderId) throw Error('diagnostic_permit_incomplete');
    // Caller must derive these from the freshly loaded lifecycle, never user input.
    if (args.lifecycleId !== permit.lifecycleId || args.clientOrderId !== permit.clientOrderId) throw Error('diagnostic_correlation_mismatch');
    if (typeof submit !== 'function') throw Error('diagnostic_submit_required');
    let fd;
    try {
      fd = fs.openSync(reservationFile, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify({ experimentId: permit.experimentId, accountIdentity: identity,
        lifecycleId: permit.lifecycleId, clientOrderId: permit.clientOrderId,
        reservedAt: new Date(time).toISOString(), status: 'ATTEMPT_RESERVED_NO_RETRY' }) + '\n');
      fs.fsyncSync(fd);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    return submit(args);
  };
}
