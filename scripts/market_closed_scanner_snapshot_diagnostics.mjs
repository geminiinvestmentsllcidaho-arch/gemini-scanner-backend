#!/usr/bin/env node
import {
  buildMarketClosedSnapshotDiagnostics,
  buildMarketClosedSnapshotPanel,
} from "../src/scanner/market_closed_scanner_snapshot_diagnostics.mjs";

const diagnostics = buildMarketClosedSnapshotDiagnostics();
const panel = buildMarketClosedSnapshotPanel({ diagnostics });

console.log(JSON.stringify({ ok: true, diagnostics, panel }, null, 2));
