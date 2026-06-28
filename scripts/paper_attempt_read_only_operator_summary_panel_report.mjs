#!/usr/bin/env node
import { buildPaperAttemptReadOnlyOperatorSummaryPanel } from "../src/scanner/paper_attempt_read_only_operator_summary_panel.mjs";

const panel = buildPaperAttemptReadOnlyOperatorSummaryPanel();
console.log(JSON.stringify(panel, null, 2));
