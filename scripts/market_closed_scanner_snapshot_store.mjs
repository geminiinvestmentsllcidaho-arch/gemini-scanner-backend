#!/usr/bin/env node
import { appendMarketClosedSnapshotRecord } from "../src/scanner/market_closed_scanner_snapshot_store.mjs";

const result = appendMarketClosedSnapshotRecord({}, { skipScriptCheck: true });
console.log(JSON.stringify(result, null, 2));
