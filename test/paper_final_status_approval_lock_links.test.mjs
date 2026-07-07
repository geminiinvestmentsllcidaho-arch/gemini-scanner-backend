import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = '/app/paper-broker-adapter-approval-lock';
const title = 'Paper Broker Adapter Approval Lock';

for (const file of [
  'src/scanner/paper_app_readiness_status_app_screen.mjs',
  'src/scanner/paper_trading_module_final_status_readonly_panel.mjs',
  'src/scanner/paper_readiness_gate_app_screen.mjs'
]) {
  test(`${file} links broker approval lock route`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes(route), `${file} missing ${route}`);
    assert.ok(source.includes(title), `${file} missing ${title}`);
    assert.doesNotMatch(source, /<form/i);
    assert.doesNotMatch(source, /<button/i);
    assert.doesNotMatch(source, /type=["']submit["']/i);
  });
}
