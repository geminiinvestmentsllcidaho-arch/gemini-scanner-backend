#!/usr/bin/env node
import { buildAiLogicOperatorApprovalRecord, appendAiLogicOperatorApprovalRecord } from "../src/scanner/ai_logic_operator_approval_record.mjs";

const value=(name)=>process.argv.find((x)=>x.startsWith(`--${name}=`))?.slice(name.length+3)??null;
const flag=(name)=>process.argv.includes(`--${name}`);
const action=value("action");
const input={
  action,
  decisionRecordId:value("decision-record-id"),
  acceptanceRecordId:value("acceptance-record-id"),
  candidateId:value("candidate-id"),
  knownGoodRecordId:value("known-good-record-id"),
  replayId:value("replay-id"),
  sourceCommitBefore:value("source-commit-before"),
  sourceCommitAfter:value("source-commit-after"),
  candidateSourceHash:value("candidate-source-hash"),
  candidatePath:value("candidate-path"),
  candidateTopic:value("candidate-topic"),
  nonce:value("nonce"),
  explicitlyApproved:flag("explicitly-approved"),
  oneShot:flag("one-shot"),
  paperOnly:flag("paper-only"),
  noLiveTradingAcknowledged:flag("ack-no-live-trading"),
  noImmutablePolicyMutationAcknowledged:flag("ack-no-immutable-policy-mutation"),
  issuedAt:value("issued-at"),
  expiresAt:value("expires-at"),
};
const record=buildAiLogicOperatorApprovalRecord(input);
if(record.valid!==true){
  console.error(JSON.stringify({ok:false,status:record.status,reasons:record.reasons},null,2));
  process.exit(1);
}
const persisted=appendAiLogicOperatorApprovalRecord(record);
console.log(JSON.stringify({
  ok:true,
  message:"AI logic operator approval recorded locally; no candidate source applied and no runtime action executed",
  appended:persisted.appended,
  approvalRecordId:record.recordId,
  action:record.action,
  paperOnly:record.paperOnly,
  oneShot:record.oneShot,
  localJsonlOnly:record.localJsonlOnly,
  productionRuntimeWiringAllowed:record.productionRuntimeWiringAllowed,
  promotionExecutionAllowed:record.promotionExecutionAllowed,
  rollbackExecutionAllowed:record.rollbackExecutionAllowed,
  brokerContactAllowed:record.brokerContactAllowed,
  orderPlacementAllowed:record.orderPlacementAllowed,
  liveTradingAllowed:record.liveTradingAllowed,
  accountMutationAllowed:record.accountMutationAllowed,
  immutablePolicyMutationAllowed:record.immutablePolicyMutationAllowed,
  thresholdMutationAllowed:record.thresholdMutationAllowed,
  sizingMutationAllowed:record.sizingMutationAllowed,
  allocationMutationAllowed:record.allocationMutationAllowed,
  gitMutationAllowed:record.gitMutationAllowed
},null,2));
