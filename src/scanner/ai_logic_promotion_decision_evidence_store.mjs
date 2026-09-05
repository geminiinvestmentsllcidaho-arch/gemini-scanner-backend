import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION = "ai_logic_promotion_decision_evidence_store_v1";
export const DEFAULT_AI_LOGIC_PROMOTION_DECISION_EVIDENCE_PATH =
  path.resolve("runs/ai_logic_promotion_decision_evidence.jsonl");

const present = (v) => typeof v === "string" && v.trim().length > 0;

export function buildAiLogicPromotionDecisionEvidenceRecord(decision = {}, options = {}) {
  const binding = decision.binding ?? {};
  const required = ["acceptanceRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"];
  if (decision.version !== "ai_logic_promotion_decision_evidence_gate_v1" ||
      decision.eligible !== true ||
      decision.status !== "AI_LOGIC_PROMOTION_DECISION_EVIDENCE_READY" ||
      decision.disposition !== "PROMOTION_DECISION_EVIDENCE_ONLY" ||
      decision.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED" ||
      required.some((k) => !present(binding[k]))) {
    throw new Error("PROMOTION_DECISION_EVIDENCE_NOT_PERSISTABLE");
  }
  for (const key of ["productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed","promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed","immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed","allocationMutationAllowed"]) {
    if (decision[key] !== false) throw new Error(`PROMOTION_DECISION_EVIDENCE_LOCK_OPEN_${key}`);
  }
  const identity = Object.freeze(Object.fromEntries(required.map((k)=>[k,binding[k]])));
  return Object.freeze({
    version: VERSION,
    recordId: crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0,32),
    recordedAt: (options.now instanceof Date ? options.now : new Date()).toISOString(),
    ...identity,
    immutableManifestStatus: "IMMUTABLE_MANIFEST_VERIFIED",
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

export function appendAiLogicPromotionDecisionEvidenceRecord(decision = {}, options = {}) {
  const record = buildAiLogicPromotionDecisionEvidenceRecord(decision, options);
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_AI_LOGIC_PROMOTION_DECISION_EVIDENCE_PATH);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });
  if (fs.existsSync(ledgerPath)) {
    for (const line of fs.readFileSync(ledgerPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let row;
      try { row = JSON.parse(line); } catch { throw new Error("PROMOTION_DECISION_EVIDENCE_LEDGER_MALFORMED"); }
      if (row?.recordId === record.recordId) return Object.freeze({ appended:false, record, ledgerPath, localJsonlOnly:true });
    }
  }
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, { encoding:"utf8", mode:0o600 });
  try { fs.chmodSync(ledgerPath, 0o600); } catch {}
  return Object.freeze({ appended:true, record, ledgerPath, localJsonlOnly:true });
}

export function listAiLogicPromotionDecisionEvidenceRecords(options = {}) {
  const ledgerPath = path.resolve(options.ledgerPath ?? DEFAULT_AI_LOGIC_PROMOTION_DECISION_EVIDENCE_PATH);
  if (!fs.existsSync(ledgerPath)) return Object.freeze([]);
  const rows=[];
  for (const line of fs.readFileSync(ledgerPath,"utf8").split("\n")) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { throw new Error("PROMOTION_DECISION_EVIDENCE_LEDGER_MALFORMED"); }
  }
  const limit = Math.max(1, Math.min(100, Number.isInteger(options.limit) ? options.limit : 20));
  return Object.freeze(rows.reverse().slice(0,limit).map((r)=>Object.freeze(r)));
}

export default Object.freeze({
  VERSION,
  DEFAULT_AI_LOGIC_PROMOTION_DECISION_EVIDENCE_PATH,
  buildAiLogicPromotionDecisionEvidenceRecord,
  appendAiLogicPromotionDecisionEvidenceRecord,
  listAiLogicPromotionDecisionEvidenceRecords,
});
