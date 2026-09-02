import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION = "ai_logic_rollback_decision_evidence_store_v1";
export const DEFAULT_AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_PATH =
  path.resolve("runs/ai_logic_rollback_decision_evidence.jsonl");

const present = (v) => typeof v === "string" && v.trim().length > 0;
const LOCKS = Object.freeze([
  "productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
  "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed",
  "orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
  "immutablePolicyMutationAllowed","thresholdMutationAllowed",
  "sizingMutationAllowed","allocationMutationAllowed",
]);

export function buildAiLogicRollbackDecisionEvidenceRecord(decision = {}, options = {}) {
  const binding = decision.binding ?? {};
  const required = [
    "promotionDecisionRecordId","acceptanceRecordId","candidateId",
    "knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter",
  ];
  if (
    decision.version !== "ai_logic_rollback_decision_evidence_gate_v1" ||
    decision.eligible !== true ||
    decision.status !== "AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_READY" ||
    decision.disposition !== "ROLLBACK_DECISION_EVIDENCE_ONLY" ||
    decision.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED" ||
    decision.rollbackTargetIdentified !== true ||
    decision.rollbackDecisionEvidenceOnly !== true ||
    required.some((k) => !present(binding[k]))
  ) throw new Error("ROLLBACK_DECISION_EVIDENCE_NOT_PERSISTABLE");
  for (const key of LOCKS) {
    if (decision[key] !== false) throw new Error(`ROLLBACK_DECISION_EVIDENCE_LOCK_OPEN_${key}`);
  }
  const identity = Object.freeze(Object.fromEntries(required.map((k) => [k, binding[k]])));
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error("ROLLBACK_DECISION_EVIDENCE_INVALID_TIME");
  return Object.freeze({
    version: VERSION,
    recordId: crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0,32),
    recordedAt: now.toISOString(),
    ...identity,
    immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
    rollbackTargetIdentified: true,
    rollbackDecisionEvidenceOnly: true,
    localJsonlOnly: true,
    productionRuntimeWiringAllowed: false,
    persistenceAllowed: false,
    promotionAllowed: false,
    promotionExecutionAllowed: false,
    rollbackExecutionAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
    immutablePolicyMutationAllowed: false,
    thresholdMutationAllowed: false,
    sizingMutationAllowed: false,
    allocationMutationAllowed: false,
  });
}

function readRows(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return [];
  const rows = [];
  for (const line of fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); }
    catch { throw new Error("ROLLBACK_DECISION_EVIDENCE_LEDGER_MALFORMED"); }
  }
  return rows;
}

export function appendAiLogicRollbackDecisionEvidenceRecord(decision = {}, options = {}) {
  const record = buildAiLogicRollbackDecisionEvidenceRecord(decision, options);
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_PATH);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });
  try { fs.chmodSync(path.dirname(ledgerPath), 0o700); } catch {}
  const rows = readRows(ledgerPath);
  if (rows.some((row) => row?.recordId === record.recordId)) {
    return Object.freeze({ appended:false, duplicateSkipped:true, record, ledgerPath, localJsonlOnly:true });
  }
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, { encoding:"utf8", mode:0o600 });
  try { fs.chmodSync(ledgerPath, 0o600); } catch {}
  return Object.freeze({ appended:true, duplicateSkipped:false, record, ledgerPath, localJsonlOnly:true });
}

export function listAiLogicRollbackDecisionEvidenceRecords(options = {}) {
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_PATH);
  const raw = Number(options.limit ?? 20);
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(100, Math.trunc(raw))) : 20;
  return Object.freeze(readRows(ledgerPath).slice(-limit).reverse().map((row) => Object.freeze({ ...row })));
}

export default Object.freeze({
  VERSION,
  DEFAULT_AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_PATH,
  buildAiLogicRollbackDecisionEvidenceRecord,
  appendAiLogicRollbackDecisionEvidenceRecord,
  listAiLogicRollbackDecisionEvidenceRecords,
});
