import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {PaperAutoExecutionLifecycleStore as Store} from '../src/scanner/paper_auto_execution_lifecycle_store.mjs';
import {readPaperAutoExecutionLifecyclePortfolio as syncRead,readPaperAutoExecutionLifecyclePortfolioAsync as read} from '../src/scanner/paper_auto_execution_lifecycle_portfolio.mjs';
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'async-lifecycle-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function create(dir,id,symbol,owned=true){const store=new Store({filePath:path.join(dir,`paper_auto_execution_${id}.json`),idFactory:()=>id});store.create({selectedSymbol:symbol,scannerEvidence:{source:owned?'paper_auto_continuity_scanner_candidate':'unowned',paperOnly:true}});return store;}
test('async discovery equals synchronous validation/filtering and preserves duplicate conflict guard',async t=>{
 const dir=fixture(t);create(dir,'a','AAA');create(dir,'b','BBB',false);fs.writeFileSync(path.join(dir,'paper_auto_execution_corrupt.json'),'{');
 assert.deepEqual((await read({runsDir:dir})).rows,syncRead({runsDir:dir}).rows);
 create(dir,'duplicate','AAA');await assert.rejects(read({runsDir:dir}),/duplicate_nonterminal_symbol:AAA/);
});
test('runtime discovery yields to exit/health timers while enumerating a mixed directory',async t=>{
 const dir=fixture(t);for(let i=0;i<512;i++)fs.writeFileSync(path.join(dir,`audit-${i}.txt`),'');create(dir,'a','AAA');
 let callbackRan=false;setImmediate(()=>{callbackRan=true});
 const p=await read({runsDir:dir});assert.equal(callbackRan,true);assert.deepEqual(p.symbols,['AAA']);
});
test('fresh scan sees external lifecycle writes and terminal transitions without cached state',async t=>{
 const dir=fixture(t);const a=create(dir,'a','AAA');assert.equal((await read({runsDir:dir})).rows.length,1);
 a.transition('CANDIDATE_EXPIRED');assert.equal((await read({runsDir:dir})).rows.length,0);
 create(dir,'b','BBB');assert.deepEqual((await read({runsDir:dir})).symbols,['BBB']);
});
test('missing directory remains empty',async()=>{assert.deepEqual((await read({runsDir:path.join(os.tmpdir(),'missing-'+Date.now())})).rows,[])});
