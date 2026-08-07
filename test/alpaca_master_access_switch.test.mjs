import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  VERSION,
  alpacaMasterAccessAllowsReadonly,
  getAlpacaMasterAccessSwitchState,
  setAlpacaMasterAccessSwitchState,
} from '../src/scanner/alpaca_master_access_switch.mjs';

async function tempStatePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gs-alpaca-access-switch-'));
  return { dir, file: path.join(dir, 'switch.json') };
}

test('Alpaca master access defaults fail-closed OFF when no state exists', async () => {
  const { dir, file } = await tempStatePath();
  try {
    const state = await getAlpacaMasterAccessSwitchState({ statePath: file, nowMs: 1_700_000_000_000 });
    assert.equal(state.version, VERSION);
    assert.equal(state.enabled, false);
    assert.equal(state.accessMode, 'ALPACA_ACCOUNT_ACCESS_OFF');
    assert.equal(state.readAccessAllowed, false);
    assert.equal(state.credentialResolutionAllowed, false);
    assert.equal(state.brokerMutationAllowed, false);
    assert.equal(state.orderPlacementAllowed, false);
    assert.equal(alpacaMasterAccessAllowsReadonly(state), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('operator may persist ON for account read access while execution remains locked', async () => {
  const { dir, file } = await tempStatePath();
  try {
    const written = await setAlpacaMasterAccessSwitchState({
      enabled: true,
      updatedBy: 'admin',
      reason: 'operator_enabled_alpaca_account_access',
    }, { statePath: file, nowMs: 1_700_000_100_000 });

    assert.equal(written.enabled, true);
    assert.equal(written.readAccessAllowed, true);
    assert.equal(written.credentialResolutionAllowed, true);
    assert.equal(written.brokerMutationAllowed, false);
    assert.equal(written.orderPlacementAllowed, false);
    assert.equal(written.orderCancellationAllowed, false);
    assert.equal(written.liveTradingAllowed, false);
    assert.equal(written.paperTradingSubmissionAllowed, false);

    const read = await getAlpacaMasterAccessSwitchState({ statePath: file });
    assert.equal(read.enabled, true);
    assert.equal(alpacaMasterAccessAllowsReadonly(read), true);

    const stat = await fs.stat(file);
    assert.equal(stat.mode & 0o777, 0o600);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('operator OFF revokes account read access immediately in persisted state', async () => {
  const { dir, file } = await tempStatePath();
  try {
    await setAlpacaMasterAccessSwitchState({ enabled: true }, { statePath: file });
    const written = await setAlpacaMasterAccessSwitchState({
      enabled: false,
      updatedBy: 'admin',
      reason: 'operator_disabled_alpaca_account_access',
    }, { statePath: file });

    assert.equal(written.enabled, false);
    assert.equal(written.readAccessAllowed, false);
    assert.equal(written.credentialResolutionAllowed, false);
    assert.equal(alpacaMasterAccessAllowsReadonly(written), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('malformed or unsafe stored state fails closed', async () => {
  const { dir, file } = await tempStatePath();
  try {
    await fs.writeFile(file, JSON.stringify({
      version: VERSION,
      enabled: true,
      readAccessAllowed: false,
      credentialResolutionAllowed: true,
    }));
    const state = await getAlpacaMasterAccessSwitchState({ statePath: file });
    assert.equal(state.enabled, false);
    assert.equal(state.readAccessAllowed, false);
    assert.equal(state.credentialResolutionAllowed, false);
    assert.equal(state.reason, 'invalid_or_unsafe_switch_state_fail_closed');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
