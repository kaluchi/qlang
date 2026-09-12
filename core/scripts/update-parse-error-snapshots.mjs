// Regenerate the parseError fixtures in the conformance suite.
// A grammar change that adds or removes a top-level alternative
// shifts the `:expected` Vec peggy reports at a failure offset, and
// every fixture in the file pins the full `::ParseError!{…}`
// descriptor. This rewrites each `parseError` case's `expect` from
// what the runtime answers, so the fixtures stay the printed form
// of the real descriptor.
//
// Run after a grammar change, then read the diff: a shifted
// `:expected` Vec is the expected churn, a changed `:marker` or
// `:location` is a behaviour change that wants a second look.

import { evalQuery, printValue } from '../src/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const FIXTURE = './test/conformance/14-parse-errors.jsonl';

const lines = readFileSync(FIXTURE, 'utf8').split('\n').filter(l => l.trim());
const out = [];
let refreshed = 0;
for (const line of lines) {
  const testCase = JSON.parse(line);
  if (testCase.error !== 'parseError') {
    out.push(JSON.stringify(testCase));
    continue;
  }
  const answered = printValue(await evalQuery(testCase.query));
  if (answered !== testCase.expect) refreshed += 1;
  testCase.expect = answered;
  out.push(JSON.stringify(testCase));
}
writeFileSync(FIXTURE, out.join('\n') + '\n');
console.log(`rewrote ${refreshed} of ${out.length} cases in ${FIXTURE}`);
