import fs from 'node:fs/promises';
import path from 'node:path';

export const VERSION = 'alpaca_master_access_switch_v1';
export const DEFAULT_ALPACA_MASTER_ACCESS_SWITCH_PATH = 'runs/alpaca_master_access_switch.json';

function statePath(options = {}) {
  return options.statePath ?? process.env.ALPACA_MASTER_ACCESS_SWITCH_PATH ?? DEFAULT_ALPACA_MASTER_ACCESS_SWITCH_PATH;
}

function normalizeState(input = {}, nowMs = Date.now()) {
  const enabled = input.enabled === true;
  return Object.freeze({
    version: VERSION,
    enabled,
    accessMode: enabled ? 'ALPACA_ACCOUNT_ACCESS_ON' : 'ALPACA_ACCOUNT_ACCESS_OFF',
    readAccessAllowed: enabled,
    credentialResolutionAllowed: enabled,
    brokerMutationAllowed: false,
    orderPlacementAllowed: false,
    orderCancellationAllowed: false,
    liveTradingAllowed: false,
    paperTradingSubmissionAllowed: false,
    reason: String(input.reason ?? (enabled ? 'operator_enabled_alpaca_account_access' : 'operator_disabled_alpaca_account_access')),
    updatedBy: String(input.updatedBy ?? input.by ?? 'operator'),
    updatedAt: new Date(Number(nowMs)).toISOString(),
  });
}

export async function getAlpacaMasterAccessSwitchState(options = {}) {
  const file = statePath(options);
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();

  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    if (
      parsed?.version !== VERSION ||
      typeof parsed?.enabled !== 'boolean' ||
      parsed?.readAccessAllowed !== parsed?.enabled ||
      parsed?.credentialResolutionAllowed !== parsed?.enabled
    ) {
      return normalizeState({
        enabled: false,
        reason: 'invalid_or_unsafe_switch_state_fail_closed',
        updatedBy: 'system',
      }, nowMs);
    }

    return Object.freeze({
      ...normalizeState(parsed, Date.parse(parsed.updatedAt) || nowMs),
      reason: String(parsed.reason ?? 'stored_switch_state'),
      updatedBy: String(parsed.updatedBy ?? 'operator'),
      updatedAt: String(parsed.updatedAt ?? new Date(nowMs).toISOString()),
    });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return normalizeState({
        enabled: false,
        reason: 'default_safe_state_no_switch_file',
        updatedBy: 'system',
      }, nowMs);
    }
    return normalizeState({
      enabled: false,
      reason: 'switch_state_read_failed_fail_closed',
      updatedBy: 'system',
    }, nowMs);
  }
}

export async function setAlpacaMasterAccessSwitchState(input = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const state = normalizeState(input, nowMs);
  const file = statePath(options);
  const dir = path.dirname(file);
  const temp = `${file}.${process.pid}.${nowMs}.tmp`;

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  await fs.rename(temp, file);
  await fs.chmod(file, 0o600);
  return state;
}

export function alpacaMasterAccessAllowsReadonly(state = {}) {
  return state?.enabled === true &&
    state?.readAccessAllowed === true &&
    state?.credentialResolutionAllowed === true;
}

export default {
  VERSION,
  DEFAULT_ALPACA_MASTER_ACCESS_SWITCH_PATH,
  getAlpacaMasterAccessSwitchState,
  setAlpacaMasterAccessSwitchState,
  alpacaMasterAccessAllowsReadonly,
};
