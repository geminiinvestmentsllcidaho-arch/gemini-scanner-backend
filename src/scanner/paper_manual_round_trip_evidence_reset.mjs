import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_PATH, VERSION, MANUAL_ROUND_TRIP_STAGE, defaultPaperManualRoundTripEvidence } from "./paper_manual_round_trip_evidence_tracker.mjs";

export const RESET_CONFIRMATION = "RESET_MANUAL_ROUND_TRIP_EVIDENCE";

function validState(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    value.version === VERSION && value.stage === MANUAL_ROUND_TRIP_STAGE &&
    typeof value.status === "string" && typeof value.baselineObserved === "boolean" &&
    typeof value.enterDetected === "boolean" && typeof value.exitDetected === "boolean" &&
    typeof value.roundTripClosed === "boolean" && typeof value.mechanicalSuccess === "boolean" &&
    value.readOnly === true && value.brokerContactAllowed === false &&
    value.orderPlacementAllowed === false && value.accountMutationAllowed === false);
}

function inspect(file) {
  try {
    const raw = fs.readFileSync(file);
    let parsed;
    try { parsed = JSON.parse(raw.toString("utf8")); }
    catch { return { exists: true, condition: "malformed", raw }; }
    if (!validState(parsed)) return { exists: true, condition: "invalid", raw };
    if (parsed.mechanicalSuccess === true || parsed.roundTripClosed === true) return { exists: true, condition: "completed", raw };
    if (parsed.baselineObserved === true || parsed.enterDetected === true || parsed.exitDetected === true) return { exists: true, condition: "in_progress", raw };
    return { exists: true, condition: "clean", raw };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, condition: "absent", raw: null };
    throw error;
  }
}

export function previewPaperManualRoundTripEvidenceReset(options = {}) {
  const file = options.path ?? process.env.PAPER_MANUAL_ROUND_TRIP_EVIDENCE_PATH ?? DEFAULT_PATH;
  const current = inspect(file);
  const resetNeeded = !["absent", "clean"].includes(current.condition);
  return Object.freeze({
    version: "paper_manual_round_trip_evidence_reset_v1",
    mode: "preview_only",
    file,
    currentCondition: current.condition,
    resetNeeded,
    confirmationRequired: resetNeeded ? RESET_CONFIRMATION : null,
    wouldArchive: resetNeeded && current.exists,
    wouldWriteFreshState: resetNeeded,
    safety: Object.freeze({ localEvidenceOnly: true, brokerContactAllowed: false, orderPlacementAllowed: false,
      accountMutationAllowed: false, watcherStartAllowed: false, executionEnabled: false }),
  });
}

export function resetPaperManualRoundTripEvidence(options = {}) {
  const file = options.path ?? process.env.PAPER_MANUAL_ROUND_TRIP_EVIDENCE_PATH ?? DEFAULT_PATH;
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const preview = previewPaperManualRoundTripEvidenceReset({ path: file });
  if (!preview.resetNeeded) return Object.freeze({ ...preview, mode: "no_change", resetPerformed: false, archivePath: null });
  if (options.confirmation !== RESET_CONFIRMATION) {
    const error = new Error("paper_manual_round_trip_reset_confirmation_required");
    error.code = "PAPER_MANUAL_RESET_CONFIRMATION_REQUIRED";
    throw error;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let archivePath = null;
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file);
    const digest = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    archivePath = `${file}.archive-${stamp}-${digest}`;
    fs.renameSync(file, archivePath);
    fs.chmodSync(archivePath, 0o600);
  }
  const fresh = defaultPaperManualRoundTripEvidence(now);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(fresh, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return Object.freeze({ ...preview, mode: "explicit_reset", resetPerformed: true, archivePath,
    freshStatus: fresh.status, freshVersion: fresh.version });
}

export default { RESET_CONFIRMATION, previewPaperManualRoundTripEvidenceReset, resetPaperManualRoundTripEvidence };
