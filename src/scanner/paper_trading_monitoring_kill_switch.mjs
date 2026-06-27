import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAPER_TRADING_MONITORING_KILL_SWITCH_VERSION = 'paper_trading_monitoring_kill_switch_v1';
export const DEFAULT_PAPER_TRADING_KILL_SWITCH_PATH = 'runs/paper_trading_kill_switch.json';
export const DEFAULT_PAPER_ORDER_MONITORING_LEDGER_PATH = 'runs/paper_order_monitoring.jsonl';

function statePath(options = {}) {
  return options.killSwitchPath ?? process.env.PAPER_TRADING_KILL_SWITCH_PATH ?? DEFAULT_PAPER_TRADING_KILL_SWITCH_PATH;
}

function ledgerPath(options = {}) {
  return options.monitoringLedgerPath ?? process.env.PAPER_ORDER_MONITORING_LEDGER_PATH ?? DEFAULT_PAPER_ORDER_MONITORING_LEDGER_PATH;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function getPaperTradingKillSwitchState(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const state = await readJson(statePath(options), null);

  if (!state) {
    return {
      version: PAPER_TRADING_MONITORING_KILL_SWITCH_VERSION,
      killSwitchActive: true,
      paperTradingDisabled: true,
      reason: 'default_safe_state_no_kill_switch_file',
      updatedAt: new Date(nowMs).toISOString()
    };
  }

  return state;
}

export async function setPaperTradingKillSwitchState(input = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const state = {
    version: PAPER_TRADING_MONITORING_KILL_SWITCH_VERSION,
    killSwitchActive: input.killSwitchActive !== false,
    paperTradingDisabled: input.paperTradingDisabled !== false,
    reason: String(input.reason ?? 'manual_kill_switch_update'),
    updatedBy: String(input.by ?? input.updatedBy ?? 'operator'),
    updatedAt: new Date(nowMs).toISOString()
  };

  const file = statePath(options);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state, null, 2) + '\n');
  return state;
}

export async function appendPaperOrderMonitoringEvent(event = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const record = {
    version: PAPER_TRADING_MONITORING_KILL_SWITCH_VERSION,
    eventType: String(event.eventType ?? 'paper_order_monitoring_event'),
    orderId: event.orderId ?? null,
    status: event.status ?? 'unknown',
    symbol: event.symbol ?? null,
    side: event.side ?? null,
    qty: event.qty ?? null,
    note: event.note ?? null,
    ts: new Date(nowMs).toISOString()
  };

  const file = ledgerPath(options);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(record) + '\n');
  return record;
}

export async function readPaperOrderMonitoringEvents(options = {}) {
  const file = ledgerPath(options);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function getPaperTradingMonitoringDiagnostics(options = {}) {
  const state = await getPaperTradingKillSwitchState(options);
  const events = await readPaperOrderMonitoringEvents(options);

  return {
    ok: true,
    version: PAPER_TRADING_MONITORING_KILL_SWITCH_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    killSwitchActive: state.killSwitchActive,
    paperTradingDisabled: state.paperTradingDisabled,
    orderStatusTrackingEnabled: true,
    trackedOrderCount: events.length,
    latestOrderEvent: events.at(-1) ?? null,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    blocked: true,
    blockReasons: [
      state.killSwitchActive ? 'paper_trading_kill_switch_active' : 'paper_trading_kill_switch_inactive_but_submit_still_locked',
      'monitoring_diagnostics_only'
    ]
  };
}

async function main() {
  const command = process.argv[2] ?? 'status';
  if (command === 'disable') {
    console.log(JSON.stringify(await setPaperTradingKillSwitchState({
      killSwitchActive: true,
      paperTradingDisabled: true,
      reason: 'operator_disabled_paper_trading'
    }), null, 2));
    return;
  }

  if (command === 'enable-preview-only') {
    console.log(JSON.stringify(await setPaperTradingKillSwitchState({
      killSwitchActive: false,
      paperTradingDisabled: false,
      reason: 'operator_enabled_preview_only_testing'
    }), null, 2));
    return;
  }

  console.log(JSON.stringify(await getPaperTradingMonitoringDiagnostics(), null, 2));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export default {
  PAPER_TRADING_MONITORING_KILL_SWITCH_VERSION,
  getPaperTradingKillSwitchState,
  setPaperTradingKillSwitchState,
  appendPaperOrderMonitoringEvent,
  readPaperOrderMonitoringEvents,
  getPaperTradingMonitoringDiagnostics
};
