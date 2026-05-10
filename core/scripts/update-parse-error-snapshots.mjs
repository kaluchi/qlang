// Regenerate :message strings inside docs/conformance parse-error
// JSONL fixtures — peggy emits an updated "Expected ..." token list
// whenever a Primary alternative is added or removed. Run after a
// grammar change that introduces / removes a top-level token.

import { evalQuery } from '../src/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const FIXTURE = './test/conformance/14-parse-errors.jsonl';

function escapeJsonString(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const lines = readFileSync(FIXTURE, 'utf8').split('\n').filter(l => l.trim());
const out = [];
for (const line of lines) {
  const tc = JSON.parse(line);
  const actual = await evalQuery(tc.query);
  const expectedVal = await evalQuery(tc.expect);
  const actualMsg = actual?.descriptor?.get('message');
  const expectedMsg = expectedVal?.descriptor?.get('message');
  if (actualMsg && expectedMsg && actualMsg !== expectedMsg) {
    const oldEsc = escapeJsonString(expectedMsg);
    const newEsc = escapeJsonString(actualMsg);
    tc.expect = tc.expect.replace(oldEsc, newEsc);
  }
  out.push(JSON.stringify(tc));
}
writeFileSync(FIXTURE, out.join('\n') + '\n');
console.log(`updated ${out.length} cases in ${FIXTURE}`);
