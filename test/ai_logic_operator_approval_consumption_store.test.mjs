import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {appendAiLogicOperatorApprovalConsumptionRecord as append,isAiLogicOperatorApprovalConsumed as consumed} from "../src/scanner/ai_logic_operator_approval_consumption_store.mjs";
const locks={productionRuntimeWiringAllowed:false,promotionExecutionAllowed:false,rollbackExecutionAllowed:false,brokerContactAllowed:false,orderPlacementAllowed:false,liveTradingAllowed:false,accountMutationAllowed:false,immutablePolicyMutationAllowed:false,thresholdMutationAllowed:false,sizingMutationAllowed:false,allocationMutationAllowed:false,gitMutationAllowed:false};
const rec=(patch={})=>({version:"ai_logic_operator_approval_consumption_record_v1",eligible:true,approvalRecordId:"ap1",nonce:"n1",action:"PROMOTION",decisionRecordId:"d1",candidateSourceHash:"c".repeat(64),currentSourceCommit:"before",targetSourceCommit:"after",...locks,...patch});
test("atomically consumes one approval and rejects replay by approval id or nonce",()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),"a54r10-"));const f=path.join(d,"x","c.jsonl");assert.equal(append(rec(),f).appended,true);assert.equal(append(rec(),f).appended,false);assert.equal(append(rec({approvalRecordId:"ap2"}),f).appended,false);assert.equal(consumed({approvalRecordId:"ap1",nonce:"n1",filePath:f}),true);assert.equal(fs.statSync(f).mode&0o777,0o600);assert.equal(fs.statSync(path.dirname(f)).mode&0o777,0o700);assert.equal(fs.existsSync(f+".lock"),false)});
test("fails closed on malformed ledger and refuses open authority",()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),"a54r10-"));const f=path.join(d,"c.jsonl");fs.writeFileSync(f,"bad\n");assert.equal(consumed({approvalRecordId:"ap1",nonce:"n1",filePath:f}),true);assert.throws(()=>append(rec({gitMutationAllowed:true}),path.join(d,"x.jsonl")))});

test("requires and persists candidate source hash",()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),"a58z9b-"));const f=path.join(d,"c.jsonl");assert.throws(()=>append(rec({candidateSourceHash:""}),f));const x=append(rec(),f);assert.equal(x.record.candidateSourceHash,"c".repeat(64))});
